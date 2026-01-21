import { NextRequest, NextResponse } from "next/server";
import tcb from "@cloudbase/node-sdk";

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

// GET: 测试数据库查询（使用多个集合）
export async function GET(request: NextRequest) {
  const requestStartTime = Date.now();
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[test-db-query ${requestId}] ========== 开始测试数据库查询 ==========`);
    console.log(`[test-db-query ${requestId}] 请求时间: ${new Date().toISOString()}`);
    
    // 环境变量检查
    console.log(`[test-db-query ${requestId}] 环境变量检查:`, {
      TCB_ENV_ID: ENV_ID,
      hasSecretId: !!process.env.TCB_SECRET_ID,
      hasSecretKey: !!process.env.TCB_SECRET_KEY,
    });
    
    // 初始化数据库连接
    console.log(`[test-db-query ${requestId}] 开始初始化数据库连接...`);
    const dbInitStartTime = Date.now();
    const db = getDatabase();
    const dbInitTime = Date.now() - dbInitStartTime;
    console.log(`[test-db-query ${requestId}] 数据库连接初始化完成，耗时: ${dbInitTime}ms`);
    
    const results: any = {};
    const queryResults: any = {};
    
    // 测试查询 1: policy_compare_records 集合
    try {
      console.log(`[test-db-query ${requestId}] 测试查询 1: policy_compare_records...`);
      const query1StartTime = Date.now();
      const result1: any = await db
        .collection("policy_compare_records")
        .limit(1)
        .get();
      const query1Time = Date.now() - query1StartTime;
      
      console.log(`[test-db-query ${requestId}] 查询 1 完成，耗时: ${query1Time}ms`);
      console.log(`[test-db-query ${requestId}] 查询 1 结果:`, {
        hasCode: typeof result1.code === 'string',
        code: result1.code,
        dataCount: result1.data ? result1.data.length : 0,
      });
      
      queryResults.policy_compare_records = {
        success: typeof result1.code !== 'string',
        time: query1Time,
        recordCount: result1.data ? result1.data.length : 0,
        error: typeof result1.code === 'string' ? {
          code: result1.code,
          message: result1.message,
        } : null,
      };
    } catch (error: any) {
      console.error(`[test-db-query ${requestId}] 查询 1 失败:`, error);
      queryResults.policy_compare_records = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
        },
      };
    }
    
    // 测试查询 2: standard_compare_records 集合
    try {
      console.log(`[test-db-query ${requestId}] 测试查询 2: standard_compare_records...`);
      const query2StartTime = Date.now();
      const result2: any = await db
        .collection("standard_compare_records")
        .limit(1)
        .get();
      const query2Time = Date.now() - query2StartTime;
      
      console.log(`[test-db-query ${requestId}] 查询 2 完成，耗时: ${query2Time}ms`);
      console.log(`[test-db-query ${requestId}] 查询 2 结果:`, {
        hasCode: typeof result2.code === 'string',
        code: result2.code,
        dataCount: result2.data ? result2.data.length : 0,
      });
      
      queryResults.standard_compare_records = {
        success: typeof result2.code !== 'string',
        time: query2Time,
        recordCount: result2.data ? result2.data.length : 0,
        error: typeof result2.code === 'string' ? {
          code: result2.code,
          message: result2.message,
        } : null,
      };
    } catch (error: any) {
      console.error(`[test-db-query ${requestId}] 查询 2 失败:`, error);
      queryResults.standard_compare_records = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
        },
      };
    }
    
    const totalTime = Date.now() - requestStartTime;
    
    // 判断整体是否成功
    const allSuccess = Object.values(queryResults).every((result: any) => result.success !== false);
    
    console.log(`[test-db-query ${requestId}] ${allSuccess ? '✅' : '⚠️'} 测试完成，总耗时: ${totalTime}ms`, {
      results: queryResults,
    });
    
    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? "所有数据库查询测试成功" : "部分数据库查询测试失败",
      results: queryResults,
      requestId,
      timing: {
        dbInit: dbInitTime,
        total: totalTime,
      },
      env: {
        envId: ENV_ID,
      },
    }, { status: allSuccess ? 200 : 500 });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[test-db-query ${requestId}] ❌ 测试失败，总耗时: ${totalTime}ms`, {
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
      message: "数据库查询测试失败",
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
