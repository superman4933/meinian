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
  const initStartTime = Date.now();
  
  if (!dbInstance) {
    console.log("[getDatabase] 初始化新的数据库连接实例...");
    const secretId = process.env.TCB_SECRET_ID;
    const secretKey = process.env.TCB_SECRET_KEY;
    
    console.log("[getDatabase] 环境变量原始数据:", {
      TCB_ENV_ID: ENV_ID,
      TCB_SECRET_ID: secretId,
      TCB_SECRET_KEY: secretKey,
    });
    
    if (!secretId || !secretKey) {
      console.error("[getDatabase] ❌ 缺少必要的环境变量");
      throw new Error("TCB_SECRET_ID and TCB_SECRET_KEY must be set in environment variables");
    }
    
    try {
      console.log("[getDatabase] 开始调用 tcb.init()...");
      const tcbInitStartTime = Date.now();
      
      dbInstance = tcb.init({
        env: ENV_ID,
        secretId: secretId,
        secretKey: secretKey,
      });
      
      const tcbInitTime = Date.now() - tcbInitStartTime;
      console.log(`[getDatabase] tcb.init() 完成，耗时: ${tcbInitTime}ms`);
      
      console.log("[getDatabase] 开始获取 database() 实例...");
      const dbGetStartTime = Date.now();
      databaseInstance = dbInstance.database();
      const dbGetTime = Date.now() - dbGetStartTime;
      console.log(`[getDatabase] database() 获取完成，耗时: ${dbGetTime}ms`);
      
      const totalInitTime = Date.now() - initStartTime;
      console.log(`[getDatabase] ✅ 数据库连接初始化完成，总耗时: ${totalInitTime}ms`);
    } catch (error: any) {
      console.error("[getDatabase] ❌ 数据库初始化失败:", {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  } else {
    console.log("[getDatabase] 复用现有数据库连接实例");
  }
  
  return databaseInstance!;
}

// POST: 创建对比记录
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[POST ${requestId}] ========== 开始处理请求 ==========`);
    console.log(`[POST ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
    const body = await request.json();
    console.log(`[POST ${requestId}] 请求体参数:`, {
      company: body.company,
      oldFileName: body.oldFileName,
      newFileName: body.newFileName,
      hasOldFileUrl: !!body.oldFileUrl,
      hasNewFileUrl: !!body.newFileUrl,
      username: body.username,
      status: body.status,
    });
    const {
      company,
      oldFileName,
      newFileName,
      oldFileUrl,
      newFileUrl,
      status = "done", // 现在只有done状态（对比完成后才保存）
      rawCozeResponse, // 扣子API的原始返回数据
      username, // 用户名（必填）
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

    console.log(`[POST ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[POST ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);

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
      username, // 保存用户名
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    console.log(`[POST ${requestId}] ========== 准备插入记录 ==========`);
    console.log(`[POST ${requestId}] 目标集合: ${COLLECTION_NAME}`);
    console.log(`[POST ${requestId}] 📤 插入数据（原始数据）:`, JSON.stringify(record, null, 2));

    // 使用SDK插入记录
    console.log(`[POST ${requestId}] 开始执行数据库插入操作...`);
    const insertStartTime = Date.now();
    
    const result: any = await db.collection(COLLECTION_NAME).add(record);
    
    const insertTime = Date.now() - insertStartTime;
    console.log(`[POST ${requestId}] 📥 数据库插入响应（原始数据）:`, JSON.stringify(result, null, 2));
    console.log(`[POST ${requestId}] 数据库插入完成，耗时: ${insertTime}ms`);

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
    if (typeof result.code === 'string') {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[POST ${requestId}] ❌ 创建记录失败，总耗时: ${totalTime}ms`, {
        code: result.code,
        message: result.message,
        result,
      });
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
      const totalTime = Date.now() - requestStartTime;
      console.error(`[POST ${requestId}] ❌ 创建记录成功但未返回ID，总耗时: ${totalTime}ms`, {
        result,
      });
      return NextResponse.json(
        {
          success: false,
          message: "创建记录成功但未返回记录ID",
        },
        { status: 500 }
      );
    }

    const totalTime = Date.now() - requestStartTime;
    console.log(`[POST ${requestId}] ✅ 创建记录成功，总耗时: ${totalTime}ms`, {
      _id,
      performance: {
        dbInit: dbInitTime,
        insert: insertTime,
        total: totalTime,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
      _id: _id, // 直接返回数据库的_id
    });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[POST ${requestId}] ❌ 创建对比记录错误，总耗时: ${totalTime}ms`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      errorString: String(error),
    });
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
  const requestStartTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[DELETE ${requestId}] ========== 开始处理请求 ==========`);
    console.log(`[DELETE ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("id"); // 数据库的_id
    const username = searchParams.get("username"); // 用户名

    console.log(`[DELETE ${requestId}] 请求参数:`, {
      _id,
      username,
      url: request.url,
    });

    if (!_id) {
      console.error(`[DELETE ${requestId}] ❌ 缺少记录ID`);
      return NextResponse.json(
        { success: false, message: "缺少记录ID" },
        { status: 400 }
      );
    }

    if (!username) {
      console.error(`[DELETE ${requestId}] ❌ 缺少用户名参数`);
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    console.log(`[DELETE ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[DELETE ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);

    // 先查询记录，验证是否属于当前用户
    console.log(`[DELETE ${requestId}] ========== 查询记录 ==========`);
    console.log(`[DELETE ${requestId}] 📤 查询请求（原始数据）:`, JSON.stringify({
      collection: COLLECTION_NAME,
      docId: _id,
    }, null, 2));
    
    const recordResult: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .get();

    console.log(`[DELETE ${requestId}] 📥 查询响应（原始数据）:`, JSON.stringify(recordResult, null, 2));

    if (typeof recordResult.code === 'string' || !recordResult.data || recordResult.data.length === 0) {
      console.warn(`[DELETE ${requestId}] ⚠️ 记录不存在`);
      return NextResponse.json(
        { success: false, message: "记录不存在" },
        { status: 404 }
      );
    }

    const record = recordResult.data[0];
    if (record.username !== username) {
      console.error(`[DELETE ${requestId}] ❌ 无权删除此记录`);
      return NextResponse.json(
        { success: false, message: "无权删除此记录" },
        { status: 403 }
      );
    }

    // 使用SDK删除记录（通过_id）
    console.log(`[DELETE ${requestId}] ========== 删除记录 ==========`);
    console.log(`[DELETE ${requestId}] 📤 删除请求（原始数据）:`, JSON.stringify({
      collection: COLLECTION_NAME,
      docId: _id,
    }, null, 2));
    
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .remove();
    
    console.log(`[DELETE ${requestId}] 📥 删除响应（原始数据）:`, JSON.stringify(result, null, 2));

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
    if (typeof result.code === 'string') {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[DELETE ${requestId}] ❌ 删除记录失败，总耗时: ${totalTime}ms`, result);
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

    const totalTime = Date.now() - requestStartTime;
    console.log(`[DELETE ${requestId}] ✅ 删除成功，总耗时: ${totalTime}ms`);
    return NextResponse.json({
      success: true,
      message: "删除成功",
      deleted: result.deleted || 0,
    });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[DELETE ${requestId}] ❌ 删除对比记录错误，总耗时: ${totalTime}ms`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      errorString: String(error),
    });
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
  const requestStartTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[PATCH ${requestId}] ========== 开始处理请求 ==========`);
    console.log(`[PATCH ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
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
      username, // 用户名（必填）
    } = body; // 使用数据库的_id字段

    console.log(`[PATCH ${requestId}] 📥 收到更新请求（原始数据）:`, JSON.stringify(body, null, 2));

    if (!_id) {
      console.error(`[PATCH ${requestId}] ❌ 缺少记录ID`);
      return NextResponse.json(
        { success: false, message: "缺少记录ID（_id）" },
        { status: 400 }
      );
    }

    if (!username) {
      console.error(`[PATCH ${requestId}] ❌ 缺少用户名参数`);
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    console.log(`[PATCH ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[PATCH ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);

    // 先查询记录，验证是否属于当前用户
    console.log(`[PATCH ${requestId}] ========== 查询记录 ==========`);
    console.log(`[PATCH ${requestId}] 📤 查询请求（原始数据）:`, JSON.stringify({
      collection: COLLECTION_NAME,
      docId: _id,
    }, null, 2));
    
    const recordResult: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .get();

    console.log(`[PATCH ${requestId}] 📥 查询响应（原始数据）:`, JSON.stringify(recordResult, null, 2));

    if (typeof recordResult.code === 'string' || !recordResult.data || recordResult.data.length === 0) {
      console.error(`[PATCH ${requestId}] ❌ 记录不存在`);
      return NextResponse.json(
        { success: false, message: "记录不存在" },
        { status: 404 }
      );
    }

    const record = recordResult.data[0];
    console.log(`[PATCH ${requestId}] 记录信息:`, {
      recordId: record._id,
      recordUsername: record.username,
      requestUsername: username,
      usernameMatch: record.username === username,
    });

    if (record.username !== username) {
      console.error(`[PATCH ${requestId}] ❌ 无权更新此记录`);
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
      console.log(`[PATCH ${requestId}] 准备更新 rawCozeResponse`);
      try {
        const serialized = rawCozeResponse ? JSON.stringify(rawCozeResponse) : null;
        updateData.rawCozeResponse = serialized;
        console.log(`[PATCH ${requestId}] rawCozeResponse 序列化成功，长度: ${serialized?.length || 0}`);
        
        // 验证序列化后的数据（需要解析两层 data）
        if (serialized) {
          try {
            const parsed = JSON.parse(serialized);
            console.log(`[PATCH ${requestId}] 验证序列化数据:`);
            console.log(`[PATCH ${requestId}] 第一层数据结构:`, {
              hasData: !!parsed?.data,
              dataType: typeof parsed?.data,
              dataKeys: parsed ? Object.keys(parsed) : [],
            });
            
            // 解析第一层 data
            let firstDataObj = parsed?.data;
            if (typeof firstDataObj === 'string') {
              try {
                firstDataObj = JSON.parse(firstDataObj);
                console.log(`[PATCH ${requestId}] 第一层 data 字段是字符串，解析成功`);
              } catch (e) {
                console.error(`[PATCH ${requestId}] ❌ 解析第一层 data 字符串失败:`, e);
              }
            }
            
            // 解析第二层 data
            if (firstDataObj && typeof firstDataObj === 'object') {
              console.log(`[PATCH ${requestId}] 第一层 data 对象结构:`, {
                hasData: !!firstDataObj.data,
                dataDataType: typeof firstDataObj.data,
                keys: Object.keys(firstDataObj),
              });
              
              let secondDataObj = firstDataObj.data;
              if (typeof secondDataObj === 'string') {
                try {
                  secondDataObj = JSON.parse(secondDataObj);
                  console.log(`[PATCH ${requestId}] 第二层 data.data 字段是字符串，解析成功`);
                } catch (e) {
                  console.error(`[PATCH ${requestId}] ❌ 解析第二层 data.data 字符串失败:`, e);
                }
              }
              
              if (secondDataObj && typeof secondDataObj === 'object') {
                console.log(`[PATCH ${requestId}] 第二层 data.data 对象结构:`, {
                  hasDetailed: !!secondDataObj.detailed,
                  keys: Object.keys(secondDataObj),
                });
                console.log(`[PATCH ${requestId}] detailed长度: ${secondDataObj.detailed?.length || 0}`);
                console.log(`[PATCH ${requestId}] detailed预览: ${secondDataObj.detailed?.substring(0, 100) || ""}`);
              } else {
                console.warn(`[PATCH ${requestId}] ⚠️ 第二层 data.data 不是对象:`, typeof secondDataObj);
              }
            } else {
              console.warn(`[PATCH ${requestId}] ⚠️ 第一层 data 不是对象:`, typeof firstDataObj);
            }
          } catch (e) {
            console.error(`[PATCH ${requestId}] ❌ 序列化数据验证失败:`, e);
          }
        }
      } catch (e) {
        console.error(`[PATCH ${requestId}] ❌ 序列化 rawCozeResponse 失败:`, e);
        return NextResponse.json(
          {
            success: false,
            message: "序列化数据失败: " + (e instanceof Error ? e.message : String(e)),
          },
          { status: 500 }
        );
      }
    }

    // 更新对比时间（如果提供）
    if (add_time !== undefined) {
      updateData.add_time = add_time;
    }

    console.log(`[PATCH ${requestId}] ========== 更新记录 ==========`);
    console.log(`[PATCH ${requestId}] 📤 更新请求（原始数据）:`, JSON.stringify({
      collection: COLLECTION_NAME,
      docId: _id,
      updateData: updateData,
    }, null, 2));

    // 使用SDK更新记录（通过数据库的_id）
    const result: any = await db
      .collection(COLLECTION_NAME)
      .doc(_id)
      .update(updateData);

    console.log(`[PATCH ${requestId}] 📥 更新响应（原始数据）:`, JSON.stringify(result, null, 2));

    // 检查是否有错误（根据文档，应该检查 typeof result.code === 'string'）
    if (typeof result.code === 'string') {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[PATCH ${requestId}] ❌ 更新记录失败，总耗时: ${totalTime}ms`, result);
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

    const totalTime = Date.now() - requestStartTime;
    console.log(`[PATCH ${requestId}] ✅ 更新成功，总耗时: ${totalTime}ms`);
    return NextResponse.json({
      success: true,
      message: "更新成功",
      data: result,
    });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[PATCH ${requestId}] ❌ 更新对比记录错误，总耗时: ${totalTime}ms`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      errorString: String(error),
    });
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
  const requestStartTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[GET ${requestId}] ========== 开始处理请求 ==========`);
    console.log(`[GET ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    const skip = (page - 1) * pageSize;
    const username = searchParams.get("username");
    const getAll = searchParams.get("all") === "true";

    console.log(`[GET ${requestId}] 请求参数:`, {
      recordId,
      page,
      pageSize,
      skip,
      username,
      getAll,
      url: request.url,
    });

    console.log(`[GET ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[GET ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);

    if (!username) {
      console.error(`[GET ${requestId}] ❌ 缺少用户名参数`);
      return NextResponse.json(
        { success: false, message: "缺少用户名参数" },
        { status: 400 }
      );
    }

    if (recordId) {
      // 查询单个记录（通过数据库的_id）
      console.log(`[GET ${requestId}] ========== 查询单个记录 ==========`);
      console.log(`[GET ${requestId}] 查询参数:`, {
        collection: COLLECTION_NAME,
        docId: recordId,
      });
      
      const singleQueryStartTime = Date.now();
      console.log(`[GET ${requestId}] 📤 发送数据库查询请求...`);
      
      const result: any = await db
        .collection(COLLECTION_NAME)
        .doc(recordId) // recordId就是数据库的_id
        .get();

      const singleQueryTime = Date.now() - singleQueryStartTime;
      console.log(`[GET ${requestId}] 📥 数据库查询响应（原始数据）:`, JSON.stringify(result, null, 2));
      console.log(`[GET ${requestId}] 单个记录查询完成，耗时: ${singleQueryTime}ms`);

      if (typeof result.code === 'string') {
        console.error(`[GET ${requestId}] ❌ 查询失败:`, {
          code: result.code,
          message: result.message,
        });
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
        console.warn(`[GET ${requestId}] ⚠️ 记录不存在，recordId: ${recordId}`);
        return NextResponse.json(
          {
            success: false,
            message: "记录不存在",
          },
          { status: 404 }
        );
      }

      const record = result.data[0];
      console.log(`[GET ${requestId}] 查询到记录:`, {
        recordId: record._id,
        recordUsername: record.username,
        requestUsername: username,
      });

      // 验证记录是否属于当前用户
      if (record.username !== username) {
        console.error(`[GET ${requestId}] ❌ 无权访问此记录`);
        return NextResponse.json(
          {
            success: false,
            message: "无权访问此记录",
          },
          { status: 403 }
        );
      }

      const totalTime = Date.now() - requestStartTime;
      console.log(`[GET ${requestId}] ✅ 单个记录查询成功，总耗时: ${totalTime}ms`);
      
      return NextResponse.json({
        success: true,
        data: record,
      });
    } else {
      // 列表查询（分页或全部）
      console.log(`[GET ${requestId}] ========== 开始列表查询 ==========`);
      console.log(`[GET ${requestId}] 查询模式: ${getAll ? '全部导出' : '分页查询'}`);
      
      // 分页查询所有记录（只查询status为done且属于当前用户的记录）
      const queryConditions = {
        collection: COLLECTION_NAME,
        where: { status: "done", username },
        orderBy: "createTime",
        order: "desc",
      };
      
      console.log(`[GET ${requestId}] 📋 构建查询条件（原始数据）:`, JSON.stringify(queryConditions, null, 2));
      
      let query = db
        .collection(COLLECTION_NAME)
        .where({
          status: "done",
          username: username, // 只查询当前用户的记录
        })
        .orderBy("createTime", "desc");
      
      if (getAll) {
        // 导出全部时，添加最大限制（防止一次性加载过多数据）
        // 如果数据量超过1000条，建议分批导出或使用其他方式
        const MAX_EXPORT_LIMIT = 1000;
        query = query.limit(MAX_EXPORT_LIMIT);
        console.log(`[GET ${requestId}] 导出全部模式，限制: ${MAX_EXPORT_LIMIT}条`);
      } else {
        // 正常分页查询
        query = query.skip(skip).limit(pageSize);
        console.log(`[GET ${requestId}] 分页查询参数:`, {
          skip,
          limit: pageSize,
        });
      }

      const queryRequest = {
        collection: COLLECTION_NAME,
        where: { status: "done", username },
        orderBy: "createTime",
        order: "desc",
        skip: getAll ? undefined : skip,
        limit: getAll ? 1000 : pageSize,
      };
      
      console.log(`[GET ${requestId}] 📤 发送数据库查询请求（原始数据）:`, JSON.stringify(queryRequest, null, 2));
      console.log(`[GET ${requestId}] 开始执行数据查询...`);
      const dataQueryStartTime = Date.now();
      
      const result: any = await query.get();
      
      const dataQueryTime = Date.now() - dataQueryStartTime;
      console.log(`[GET ${requestId}] 📥 数据库查询响应（原始数据）:`, JSON.stringify(result, null, 2));
      console.log(`[GET ${requestId}] 数据查询完成，耗时: ${dataQueryTime}ms`);

      if (typeof result.code === 'string') {
        console.error(`[GET ${requestId}] ❌ 数据查询失败:`, {
          code: result.code,
          message: result.message,
          queryTime: dataQueryTime,
        });
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
      console.log(`[GET ${requestId}] 查询到 ${dataCount} 条记录`);

      // 如果获取全部，直接返回数据，不需要分页信息
      if (getAll) {
        const returnedCount = dataCount;
        // 如果返回的数据量等于限制，可能还有更多数据
        const hasMore = returnedCount >= 1000;
        
        const totalTime = Date.now() - requestStartTime;
        console.log(`[GET ${requestId}] ✅ 全部导出完成，总耗时: ${totalTime}ms`, {
          returnedCount,
          hasMore,
        });
        
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
      console.log(`[GET ${requestId}] ========== 开始查询总数 ==========`);
      const countQueryStartTime = Date.now();
      
      const countQueryConditions = {
        collection: COLLECTION_NAME,
        where: {
          status: "done",
          username: username,
        },
        field: { _id: true },
      };
      
      console.log(`[GET ${requestId}] 📋 总数查询条件（原始数据）:`, JSON.stringify(countQueryConditions, null, 2));
      
      const countQuery = db
        .collection(COLLECTION_NAME)
        .where({
          status: "done",
          username: username, // 只查询当前用户的记录
        });
      
      // 获取总数（通过查询所有记录，但只取第一个字段来获取总数）
      // 由于SDK限制，我们使用一个技巧：查询所有记录但只获取_id字段
      console.log(`[GET ${requestId}] 📤 发送总数查询请求（原始数据）:`, JSON.stringify(countQueryConditions, null, 2));
      console.log(`[GET ${requestId}] 执行总数查询（仅查询_id字段）...`);
      
      const allRecords: any = await countQuery.field({ _id: true }).get();
      
      const countQueryTime = Date.now() - countQueryStartTime;
      console.log(`[GET ${requestId}] 📥 总数查询响应（原始数据）:`, JSON.stringify(allRecords, null, 2));
      console.log(`[GET ${requestId}] 总数查询完成，耗时: ${countQueryTime}ms`);
      
      let total = 0;
      if (typeof allRecords.code === 'string') {
        // 如果查询失败，使用当前页的数据量估算
        console.warn(`[GET ${requestId}] ⚠️ 总数查询失败，使用当前页数据量估算:`, {
          code: allRecords.code,
          message: allRecords.message,
        });
        total = dataCount;
      } else {
        total = allRecords.data ? allRecords.data.length : 0;
        console.log(`[GET ${requestId}] 查询到总数: ${total} 条记录`);
      }
      
      const totalPages = Math.ceil(total / pageSize);
      const totalTime = Date.now() - requestStartTime;

      console.log(`[GET ${requestId}] ✅ 分页查询成功，总耗时: ${totalTime}ms`, {
        page,
        pageSize,
        total,
        totalPages,
        dataCount,
        performance: {
          dbInit: dbInitTime,
          dataQuery: dataQueryTime,
          countQuery: countQueryTime,
          total: totalTime,
        },
      });

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
    const totalTime = Date.now() - requestStartTime;
    console.error(`[GET ${requestId}] ❌ 查询对比记录错误，总耗时: ${totalTime}ms`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      errorString: String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: error.message || "查询记录失败",
      },
      { status: 500 }
    );
  }
}
