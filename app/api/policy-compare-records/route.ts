import { NextRequest, NextResponse } from "next/server";
import tcb from "@cloudbase/node-sdk";

// 腾讯云开发环境ID
const ENV_ID = process.env.TCB_ENV_ID || "pet-8g5ohyrp269f409e-9bua741dcc7";
const COLLECTION_NAME = "policy_compare_records";

// 初始化腾讯云SDK（每次重新初始化，适配 Serverless 环境）
function getDatabase() {
  const secretId = process.env.TCB_SECRET_ID;
  const secretKey = process.env.TCB_SECRET_KEY;
  
  if (!secretId || !secretKey) {
    throw new Error("TCB_SECRET_ID and TCB_SECRET_KEY must be set in environment variables");
  }
  
  const dbInstance = tcb.init({
    env: ENV_ID,
    secretId: secretId,
    secretKey: secretKey,
  });
  
  return dbInstance.database();
}

// POST: 创建对比记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company,
      oldFileName,
      newFileName,
      oldFileUrl,
      newFileUrl,
      status = "done",
      rawCozeResponse,
      username,
    } = body;

    if (!company || !oldFileName || !newFileName) {
      return NextResponse.json(
        { success: false, message: "缺少必要参数" },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 获取北京时间（UTC+8）
    const getBeijingTime = () => {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      return beijingTime.toISOString();
    };

    const record: any = {
      company,
      oldFileName,
      newFileName,
      oldFileUrl: oldFileUrl || "",
      newFileUrl: newFileUrl || "",
      status: "done",
      rawCozeResponse: rawCozeResponse ? JSON.stringify(rawCozeResponse) : null,
      add_time: getBeijingTime(),
      isVerified: false,
      username,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    const result: any = await db.collection(COLLECTION_NAME).add(record);

    if (typeof result.code === 'string') {
      console.error("创建记录失败:", result);
      return NextResponse.json(
        {
          success: false,
          message: result.message || "创建记录失败",
          code: result.code,
        },
        { status: 500 }
      );
    }

    const _id = result.id || result._id || result.ids?.[0];
    
    if (!_id) {
      console.error("创建记录成功但未返回ID:", result);
      return NextResponse.json(
        {
          success: false,
          message: "创建记录成功但未返回记录ID",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      _id: _id,
    });
  } catch (error: any) {
    console.error("创建对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "创建记录失败",
      },
      { status: 500 }
    );
  }
}

// DELETE: 删除对比记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("id");
    const username = searchParams.get("username");

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "缺少记录ID" },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 先查询记录，验证是否属于当前用户
    const recordResult: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .get();

    if (typeof recordResult.code === 'string' || !recordResult.data || recordResult.data.length === 0) {
      return NextResponse.json(
        { success: false, message: "记录不存在" },
        { status: 404 }
      );
    }

    const record = recordResult.data[0];
    if (record.username !== username) {
      return NextResponse.json(
        { success: false, message: "无权删除此记录" },
        { status: 403 }
      );
    }

    // 使用SDK删除记录（通过_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .remove();

    if (typeof result.code === 'string') {
      console.error("删除记录失败:", result);
      // 如果记录不存在，也视为成功（幂等性）
      if (result.code === 'DATABASE_PERMISSION_DENIED' || result.message?.includes('not found')) {
        return NextResponse.json({
          success: true,
          message: "记录不存在或已删除",
        });
      }
      return NextResponse.json(
        {
          success: false,
          message: result.message || "删除记录失败",
          code: result.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "删除成功",
      deleted: result.deleted || 0,
    });
  } catch (error: any) {
    console.error("删除对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "删除记录失败",
      },
      { status: 500 }
    );
  }
}

// PATCH: 更新对比记录状态或审核状态
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      _id, 
      status, 
      comparisonResult, 
      isVerified,
      company,
      oldFileName,
      newFileName,
      oldFileUrl,
      newFileUrl,
      rawCozeResponse,
      add_time,
      username,
    } = body;

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "缺少记录ID（_id）" },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 先查询记录，验证是否属于当前用户
    const recordResult: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .get();

    if (typeof recordResult.code === 'string' || !recordResult.data || recordResult.data.length === 0) {
      return NextResponse.json(
        { success: false, message: "记录不存在" },
        { status: 404 }
      );
    }

    const record = recordResult.data[0];
    if (record.username !== username) {
      return NextResponse.json(
        { success: false, message: "无权更新此记录" },
        { status: 403 }
      );
    }

    // 构建更新数据
    const updateData: any = {
      updateTime: new Date().toISOString(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
    }

    if (comparisonResult !== undefined) {
      if (typeof comparisonResult === 'object' && comparisonResult !== null) {
        updateData.comparisonResult = JSON.stringify(comparisonResult);
      } else {
        updateData.comparisonResult = comparisonResult;
      }
    }

    if (company !== undefined) {
      updateData.company = company;
    }

    if (oldFileName !== undefined) {
      updateData.oldFileName = oldFileName;
    }
    if (newFileName !== undefined) {
      updateData.newFileName = newFileName;
    }

    if (oldFileUrl !== undefined) {
      updateData.oldFileUrl = oldFileUrl;
    }
    if (newFileUrl !== undefined) {
      updateData.newFileUrl = newFileUrl;
    }

    if (rawCozeResponse !== undefined) {
      try {
        updateData.rawCozeResponse = rawCozeResponse ? JSON.stringify(rawCozeResponse) : null;
      } catch (e) {
        console.error("序列化 rawCozeResponse 失败:", e);
        return NextResponse.json(
          {
            success: false,
            message: "序列化数据失败: " + (e instanceof Error ? e.message : String(e)),
          },
          { status: 500 }
        );
      }
    }

    if (add_time !== undefined) {
      updateData.add_time = add_time;
    }

    // 使用SDK更新记录（通过数据库的_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .update(updateData);

    if (typeof result.code === 'string') {
      console.error("更新记录失败:", result);
      if (result.code === 'DATABASE_PERMISSION_DENIED' || result.message?.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            message: "记录不存在",
            code: result.code,
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: result.message || "更新记录失败",
          code: result.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "更新成功",
      data: result,
    });
  } catch (error: any) {
    console.error("更新对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "更新记录失败",
      },
      { status: 500 }
    );
  }
}

// GET: 分页查询历史记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    const skip = (page - 1) * pageSize;
    const username = searchParams.get("username");
    const getAll = searchParams.get("all") === "true";

    if (!username) {
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    if (recordId) {
      // 查询单个记录（通过数据库的_id）
      const result: any = await db
        .collection(COLLECTION_NAME)
        .doc(recordId)
        .get();

      if (typeof result.code === 'string') {
        return NextResponse.json(
          {
            success: false,
            message: result.message || "查询失败",
            code: result.code,
          },
          { status: 500 }
        );
      }

      if (!result.data || result.data.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "记录不存在",
          },
          { status: 404 }
        );
      }

      const record = result.data[0];
      // 验证记录是否属于当前用户
      if (record.username !== username) {
        return NextResponse.json(
          {
            success: false,
            message: "无权访问此记录",
          },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: record,
      });
    } else {
      console.error("列表查询数据库名称:", COLLECTION_NAME);
      // 列表查询（分页或全部）
      let query = db
        .collection(COLLECTION_NAME)
        .limit(1)
        // .where({
        //   status: "done",
        //   username: username,
        // })
        // .orderBy("createTime", "desc");
      
      // if (getAll) {
      //   const MAX_EXPORT_LIMIT = 1000;
      //   query = query.limit(MAX_EXPORT_LIMIT);
      // } else {
      //   query = query.skip(skip).limit(pageSize);
      // }

      const result: any = await query.get();

      if (typeof result.code === 'string') {
        console.error("数据查询失败:", result);
        return NextResponse.json(
          {
            success: false,
            message: result.message || "查询失败",
            code: result.code,
          },
          { status: 500 }
        );
      }

      const dataCount = result.data ? result.data.length : 0;

      // 如果获取全部，直接返回数据，不需要分页信息
      if (getAll) {
        const returnedCount = dataCount;
        const hasMore = returnedCount >= 1000;
        
        return NextResponse.json({
          success: true,
          data: result.data || [],
          total: returnedCount,
          hasMore: hasMore,
          message: hasMore ? "数据量较大，仅返回前1000条记录。如需导出全部数据，请联系管理员。" : undefined,
        });
      }

      // 查询总数（通过查询所有记录，但只取_id字段）
      const countQuery = db
        .collection(COLLECTION_NAME)
        .where({
          status: "done",
          username: username,
        });
      
      const allRecords: any = await countQuery.field({ _id: true }).get();
      
      let total = 0;
      if (typeof allRecords.code === 'string') {
        total = dataCount;
      } else {
        total = allRecords.data ? allRecords.data.length : 0;
      }
      
      const totalPages = Math.ceil(total / pageSize);

      return NextResponse.json({
        success: true,
        data: result.data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    }
  } catch (error: any) {
    console.error("查询对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "查询记录失败",
      },
      { status: 500 }
    );
  }
}
