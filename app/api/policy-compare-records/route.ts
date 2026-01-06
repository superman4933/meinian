import { NextRequest, NextResponse } from "next/server";
import tcb from "@cloudbase/node-sdk";

// 腾讯云开发环境ID
const ENV_ID = process.env.TCB_ENV_ID || "pet-8g5ohyrp269f409e-9bua741dcc7";
const COLLECTION_NAME = "policy_compare_records";

// 初始化腾讯云SDK（单例模式，复用连接）
// 参考文档：https://docs.cloudbase.net/api-reference/server/node-sdk/initialization
let dbInstance: ReturnType<typeof tcb.init> | null = null;
let databaseInstance: ReturnType<ReturnType<typeof tcb.init>["database"]> | null = null;

function getDatabase() {
  if (!dbInstance) {
    const secretId = process.env.TCB_SECRET_ID;
    const secretKey = process.env.TCB_SECRET_KEY;
    
    if (!secretId || !secretKey) {
      throw new Error("TCB_SECRET_ID and TCB_SECRET_KEY must be set in environment variables");
    }
    
    dbInstance = tcb.init({
      env: ENV_ID,
      secretId: secretId,
      secretKey: secretKey,
    });
    databaseInstance = dbInstance.database();
  }
  return databaseInstance!;
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
      status = "done", // 现在只有done状态（对比完成后才保存）
      rawCozeResponse, // 扣子API的原始返回数据
    } = body;

    if (!company || !oldFileName || !newFileName) {
      return NextResponse.json(
        { success: false, message: "缺少必要参数" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 获取北京时间（UTC+8）
    const getBeijingTime = () => {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
      return beijingTime.toISOString();
    };

    // 构建记录数据（保存扣子API的原始返回数据，不解析）
    const record: any = {
      company,
      oldFileName,
      newFileName,
      oldFileUrl: oldFileUrl || "",
      newFileUrl: newFileUrl || "",
      status: "done", // 只有对比完成后才保存，所以状态固定为done
      rawCozeResponse: rawCozeResponse ? JSON.stringify(rawCozeResponse) : null, // 保存原始数据为JSON字符串
      add_time: getBeijingTime(), // 对比时间（北京时间）
      isVerified: false, // 是否已审核确认（默认未审核）
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    // 使用SDK插入记录
    const result: any = await db.collection(COLLECTION_NAME).add(record);

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
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

    // Node.js SDK的add方法返回格式：{ id: string, ids: string[] }
    // 或者可能是 { _id: string }，需要兼容两种格式
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
      _id: _id, // 直接返回数据库的_id
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
    const _id = searchParams.get("id"); // 数据库的_id

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "缺少记录ID" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 使用SDK删除记录（通过_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .remove();

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
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
    } = body; // 使用数据库的_id字段

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "缺少记录ID（_id）" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 构建更新数据
    const updateData: any = {
      updateTime: new Date().toISOString(),
    };

    // 更新状态（如果提供）
    if (status !== undefined) {
      updateData.status = status;
    }

    // 更新审核状态（如果提供）
    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
    }

    // 更新对比结果（如果提供）
    if (comparisonResult !== undefined) {
      if (typeof comparisonResult === 'object' && comparisonResult !== null) {
        updateData.comparisonResult = JSON.stringify(comparisonResult);
      } else {
        updateData.comparisonResult = comparisonResult;
      }
    }

    // 更新公司名称（如果提供）
    if (company !== undefined) {
      updateData.company = company;
    }

    // 更新文件名（如果提供）
    if (oldFileName !== undefined) {
      updateData.oldFileName = oldFileName;
    }
    if (newFileName !== undefined) {
      updateData.newFileName = newFileName;
    }

    // 更新文件URL（如果提供）
    if (oldFileUrl !== undefined) {
      updateData.oldFileUrl = oldFileUrl;
    }
    if (newFileUrl !== undefined) {
      updateData.newFileUrl = newFileUrl;
    }

    // 更新原始扣子API返回数据（如果提供）
    if (rawCozeResponse !== undefined) {
      updateData.rawCozeResponse = rawCozeResponse ? JSON.stringify(rawCozeResponse) : null;
    }

    // 更新对比时间（如果提供）
    if (add_time !== undefined) {
      updateData.add_time = add_time;
    }

    // 使用SDK更新记录（通过数据库的_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .update(updateData);

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
    if (typeof result.code === 'string') {
      console.error("更新记录失败:", result);
      // 如果记录不存在，返回404
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

    const db = getDatabase();

    if (recordId) {
      // 查询单个记录（通过数据库的_id）
      const result: any = await db
        .collection(COLLECTION_NAME)
        .doc(recordId) // recordId就是数据库的_id
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

      return NextResponse.json({
        success: true,
        data: result.data[0],
      });
    } else {
      // 检查是否要获取所有记录（用于导出）
      const getAll = searchParams.get("all") === "true";
      
      // 分页查询所有记录（只查询status为done的记录）
      let query = db
        .collection(COLLECTION_NAME)
        .where({
          status: "done",
        })
        .orderBy("createTime", "desc");
      
      if (getAll) {
        // 导出全部时，添加最大限制（防止一次性加载过多数据）
        // 如果数据量超过1000条，建议分批导出或使用其他方式
        const MAX_EXPORT_LIMIT = 1000;
        query = query.limit(MAX_EXPORT_LIMIT);
      } else {
        // 正常分页查询
        query = query.skip(skip).limit(pageSize);
      }

      const result: any = await query.get();

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

      // 如果获取全部，直接返回数据，不需要分页信息
      if (getAll) {
        const returnedCount = result.data ? result.data.length : 0;
        // 如果返回的数据量等于限制，可能还有更多数据
        const hasMore = returnedCount >= 1000;
        
        return NextResponse.json({
          success: true,
          data: result.data || [],
          total: returnedCount,
          hasMore: hasMore,
          message: hasMore ? "数据量较大，仅返回前1000条记录。如需导出全部数据，请联系管理员。" : undefined,
        });
      }

      // 查询总数（先查询所有记录，然后计算总数）
      // 注意：Node.js SDK可能没有count方法，所以先查询所有记录
      const countQuery = db
        .collection(COLLECTION_NAME)
        .where({
          status: "done",
        });
      
      // 获取总数（通过查询所有记录，但只取第一个字段来获取总数）
      // 由于SDK限制，我们使用一个技巧：查询所有记录但只获取_id字段
      const allRecords: any = await countQuery.field({ _id: true }).get();
      
      let total = 0;
      if (typeof allRecords.code === 'string') {
        // 如果查询失败，使用当前页的数据量估算
        total = result.data ? result.data.length : 0;
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
