import { NextRequest, NextResponse } from "next/server";
import tcb from "@cloudbase/node-sdk";
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 腾讯云开发环境ID
const ENV_ID = process.env.TCB_ENV_ID || "pet-8g5ohyrp269f409e-9bua741dcc7";

// 初始化数据库连接
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

// GET: 测试数据库连接并获取数据
export async function GET(request: NextRequest) {
  const requestStartTime = Date.now();
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[test-db-connection ${requestId}] ========== 开始测试数据库连接 ==========`);
    console.log(`[test-db-connection ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
    // 解析 URL 参数
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 1; // 默认查询 1 条
    
    // 验证 limit 参数
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({
        success: false,
        message: "limit 参数无效，必须是 1-100 之间的数字",
        receivedLimit: limitParam,
      }, { status: 400 });
    }
    
    console.log(`[test-db-connection ${requestId}] URL 参数解析:`, {
      requestUrl: request.url,
      limitParam,
      parsedLimit: limit,
      // 测试两种解析方式
      nextUrlSearchParams: request.nextUrl?.searchParams?.toString() || "未定义",
      urlSearchParams: searchParams.toString(),
    });
    
    // 环境变量检查
    console.log(`[test-db-connection ${requestId}] 环境变量检查:`, {
      TCB_ENV_ID: ENV_ID,
      hasSecretId: !!process.env.TCB_SECRET_ID,
      hasSecretKey: !!process.env.TCB_SECRET_KEY,
    });
    
    // 初始化数据库连接
    console.log(`[test-db-connection ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[test-db-connection ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);
    
    // 测试查询 - 使用 limit 参数
    console.log(`[test-db-connection ${requestId}] 开始执行测试查询，limit: ${limit}...`);
    const queryStartTime = Date.now();
    
    const result: any = await db
      .collection("policy_compare_records")
      .limit(limit) // 使用参数中的 limit
      .get();
    
    const queryTime = Date.now() - queryStartTime;
    console.log(`[test-db-connection ${requestId}] 查询完成，耗时: ${queryTime}ms`);
    console.log(`[test-db-connection ${requestId}] 查询结果（原始数据）:`, JSON.stringify(result, null, 2));
    
    // 检查查询结果
    if (typeof result.code === 'string') {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[test-db-connection ${requestId}] ❌ 查询返回错误码，总耗时: ${totalTime}ms`, {
        code: result.code,
        message: result.message,
      });
      
      return NextResponse.json({
        success: false,
        message: "数据库查询失败",
        error: {
          code: result.code,
          message: result.message,
        },
        requestId,
        timing: {
          dbInit: dbInitTime,
          query: queryTime,
          total: totalTime,
        },
      }, { status: 500 });
    }
    
    const totalTime = Date.now() - requestStartTime;
    const dataCount = result.data ? result.data.length : 0;
    
    console.log(`[test-db-connection ${requestId}] ✅ 测试成功，总耗时: ${totalTime}ms`, {
      dataCount,
      hasData: dataCount > 0,
      requestedLimit: limit,
      actualReturned: dataCount,
    });
    
    return NextResponse.json({
      success: true,
      message: "数据库连接测试成功",
      data: {
        collection: "policy_compare_records",
        recordCount: dataCount,
        requestedLimit: limit,
        records: result.data || [],
      },
      requestId,
      timing: {
        dbInit: dbInitTime,
        query: queryTime,
        total: totalTime,
      },
      env: {
        envId: ENV_ID,
      },
      params: {
        limit: limit,
        limitParam: limitParam,
      },
    });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[test-db-connection ${requestId}] ❌ 测试失败，总耗时: ${totalTime}ms`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      errorString: String(error),
    });
    
    return NextResponse.json({
      success: false,
      message: "数据库连接测试失败",
      error: {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        name: error.name,
      },
      requestId,
      timing: {
        total: totalTime,
      },
    }, { status: 500 });
  }
}
