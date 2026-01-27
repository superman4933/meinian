import { NextRequest, NextResponse } from "next/server";
import tcb from "@cloudbase/node-sdk";
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 腾讯云开发环境ID
const ENV_ID = process.env.TCB_ENV_ID || "pet-8g5ohyrp269f409e-9bua741dcc7";
const COLLECTION_NAME = "standard_compare_records";

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

// POST: 创建标准对比记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      city,
      fileName,
      fileUrl,
      standardItems, // StandardItem[] 数组
      status = "done", // 现在只有done状态（对比完成后才保存）
      rawCozeResponse, // 扣子API的原始返回数据
      username, // 用户名（必填）
    } = body;

    if (!city || !fileName || !fileUrl) {
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
      const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
      return beijingTime.toISOString();
    };

    // 构建记录数据（保存扣子API的原始返回数据，不解析）
    const record: any = {
      city,
      fileName,
      fileUrl,
      standardItems: standardItems ? JSON.stringify(standardItems) : null, // 保存标准项数组为JSON字符串
      status: "done", // 只有对比完成后才保存，所以状态固定为done
      rawCozeResponse: rawCozeResponse ? JSON.stringify(rawCozeResponse) : null, // 保存原始数据为JSON字符串
      add_time: getBeijingTime(), // 对比时间（北京时间）
      isVerified: false, // 是否已审核确认（默认未审核）
      username, // 保存用户名
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
      _id: _id,
    });
  } catch (error: any) {
    console.error("创建标准对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "创建记录失败",
      },
      { status: 500 }
    );
  }
}

// DELETE: 删除标准对比记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("id");
    const username = searchParams.get("username"); // 用户名

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
        { success: false, message: "无权删除此记录" },
        { status: 403 }
      );
    }

    // 使用SDK删除记录（通过数据库的_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .remove();

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
    if (typeof result.code === 'string') {
      console.error("删除记录失败:", result);
      // 如果记录不存在或权限不足，也视为成功（幂等性）
      if (result.code === 'DATABASE_PERMISSION_DENIED' || result.message?.includes('not found')) {
        return NextResponse.json({
          success: true,
          message: "记录不存在或已删除",
          deleted: 0,
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
      data: result,
      deleted: result.deleted || 0,
    });
  } catch (error: any) {
    console.error("删除标准对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "删除记录失败",
      },
      { status: 500 }
    );
  }
}

// PATCH: 更新标准对比记录状态或审核状态
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      _id, 
      status, 
      isVerified,
      city,
      fileName,
      fileUrl,
      standardItems,
      rawCozeResponse,
      add_time,
      username, // 用户名（必填）
    } = body; // 使用数据库的_id字段

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

    // 更新状态（如果提供）
    if (status !== undefined) {
      updateData.status = status;
    }

    // 更新审核状态（如果提供）
    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
    }

    // 更新城市（如果提供）
    if (city !== undefined) {
      updateData.city = city;
    }

    // 更新文件名（如果提供）
    if (fileName !== undefined) {
      updateData.fileName = fileName;
    }

    // 更新文件URL（如果提供）
    if (fileUrl !== undefined) {
      updateData.fileUrl = fileUrl;
    }

    // 更新标准项数组（如果提供）
    if (standardItems !== undefined) {
      updateData.standardItems = standardItems ? JSON.stringify(standardItems) : null;
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
    console.error("更新标准对比记录错误:", error);
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
    const _id = searchParams.get("id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    const isVerifiedFilter = searchParams.get("isVerified"); // 筛选参数

    const db = getDatabase();

    const username = searchParams.get("username"); // 用户名

    if (!username) {
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    if (_id) {
      // 查询单个记录（通过数据库的_id）
      const result: any = await db
        .collection(COLLECTION_NAME)
        .doc(_id)
        .get();

      if (typeof result.code === 'string') {
        console.error("查询记录失败:", result);
        return NextResponse.json(
          {
            success: false,
            message: result.message || "查询记录失败",
            code: result.code,
          },
          { status: 500 }
        );
      }

      const record = result.data?.[0];
      if (!record) {
        return NextResponse.json({
          success: true,
          data: null,
        });
      }

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
    }

    // 查询所有记录（分页，只查询当前用户的记录）
    let query = db.collection(COLLECTION_NAME).where({ 
      status: "done",
      username: username, // 只查询当前用户的记录
    });

    // 应用isVerified筛选
    if (isVerifiedFilter === "true") {
      query = query.where({ isVerified: true });
    } else if (isVerifiedFilter === "false") {
      query = query.where({ isVerified: db.command.neq(true) }); // 匹配false或undefined
    }

    // 获取总数
    const countResult: any = await query.count();
    if (typeof countResult.code === 'string') {
      console.error("查询记录总数失败:", countResult);
      return NextResponse.json(
        {
          success: false,
          message: countResult.message || "查询记录总数失败",
          code: countResult.code,
        },
        { status: 500 }
      );
    }
    const total = countResult.total;

    // 查询记录（按时间倒序）
    const records: any = await query
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    if (typeof records.code === 'string') {
      console.error("查询记录失败:", records);
      return NextResponse.json(
        {
          success: false,
          message: records.message || "查询记录失败",
          code: records.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: records.data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasPrevPage: page > 1,
        hasNextPage: page * pageSize < total,
      },
    });
  } catch (error: any) {
    console.error("查询标准对比记录错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "查询记录失败",
      },
      { status: 500 }
    );
  }
}

