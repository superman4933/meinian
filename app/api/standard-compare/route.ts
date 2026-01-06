import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";
import tcb from "@cloudbase/node-sdk";

// 腾讯云开发环境ID
const ENV_ID = process.env.TCB_ENV_ID || "pet-8g5ohyrp269f409e-9bua741dcc7";
const COLLECTION_NAME = "standard_compare_records";

// 初始化腾讯云SDK（单例模式，复用连接）
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

const WORKFLOW_ID = "7589638340099620891";
const MAX_RETRIES = 5; // 最大重试次数
const RETRY_DELAY = 2000; // 重试延迟（毫秒）

// 从扣子API返回的数据中提取内容（支持多层嵌套的JSON字符串）
function extractContent(data: any): any {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // 尝试从data.data中提取内容
  let extractedContent = null;
  
  if (data.data && typeof data.data === 'string') {
    // data.data 是字符串，尝试解析
    try {
      const parsed = JSON.parse(data.data);
      if (parsed.data && typeof parsed.data === 'string') {
        // 继续解析内层字符串
        try {
          extractedContent = JSON.parse(parsed.data);
        } catch (e) {
          extractedContent = parsed.data;
        }
      } else {
        extractedContent = parsed.data || parsed;
      }
    } catch (e) {
      extractedContent = data.data;
    }
  } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    // data.data 是对象（不是数组）
    if (data.data.data && typeof data.data.data === 'string') {
      try {
        extractedContent = JSON.parse(data.data.data);
      } catch (e) {
        extractedContent = data.data.data;
      }
    } else {
      extractedContent = data.data.data || data.data;
    }
  } else {
    extractedContent = data.data;
  }

  return extractedContent;
}

// 检查提取的内容是否是有效的JSON格式（包含预期的结构化数据字段）
function isValidJsonFormat(extractedContent: any): boolean {
  if (!extractedContent) {
    return false;
  }

  // 检查是否是数组
  if (Array.isArray(extractedContent)) {
    // 检查数组中的元素是否包含预期的字段
    if (extractedContent.length > 0) {
      const firstItem = extractedContent[0];
      return (
        typeof firstItem === 'object' &&
        firstItem !== null &&
        ('id' in firstItem || 'name' in firstItem || 'status' in firstItem || 'matched' in firstItem)
      );
    }
    return false;
  }

  // 如果是对象，检查是否包含预期的字段
  if (typeof extractedContent === 'object' && extractedContent !== null) {
    return (
      'id' in extractedContent ||
      'name' in extractedContent ||
      'status' in extractedContent ||
      'matched' in extractedContent
    );
  }

  return false;
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 调用扣子工作流API（带重试）
async function callCozeWorkflow(
  cozeToken: string,
  file_url: string
): Promise<{ response: Response; data: any }> {
  const requestBody = {
    workflow_id: WORKFLOW_ID,
    parameters: {
      file_name: file_url,
    },
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`调用扣子工作流API - 第 ${attempt}/${MAX_RETRIES} 次尝试:`, {
      file_url,
      requestBody: JSON.stringify(requestBody, null, 2),
    });

    const response = await fetch("https://api.coze.cn/v1/workflow/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cozeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      console.error(`扣子工作流API返回非JSON响应 (第 ${attempt}/${MAX_RETRIES} 次):`, {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      if (attempt < MAX_RETRIES) {
        console.log(`等待 ${RETRY_DELAY}ms 后重试...`);
        await delay(RETRY_DELAY);
        continue;
      } else {
        throw new Error(`扣子API返回非JSON响应 (${response.status}): ${response.statusText}`);
      }
    }

    if (!response.ok) {
      console.error(`扣子工作流API调用失败 (第 ${attempt}/${MAX_RETRIES} 次):`, {
        status: response.status,
        statusText: response.statusText,
        errorData: data,
      });
      if (attempt < MAX_RETRIES) {
        console.log(`等待 ${RETRY_DELAY}ms 后重试...`);
        await delay(RETRY_DELAY);
        continue;
      } else {
        throw new Error(`扣子API返回错误: ${data.message || data.error || response.statusText || "未知错误"}`);
      }
    }

    const extractedContent = extractContent(data);
    const isValid = isValidJsonFormat(extractedContent);
    console.log(`数据格式检查 (第 ${attempt}/${MAX_RETRIES} 次):`, {
      isValid,
      hasData: !!data.data,
      dataType: typeof data.data,
      extractedContentType: typeof extractedContent,
      isArray: Array.isArray(extractedContent),
      extractedContentPreview: JSON.stringify(extractedContent, null, 2).substring(0, 500) + "...",
    });

    if (isValid) {
      console.log(`✅ 成功获取JSON格式数据 (第 ${attempt}/${MAX_RETRIES} 次)`);
      return { response, data };
    } else {
      if (attempt < MAX_RETRIES) {
        console.warn(`⚠️ 返回数据不是预期的JSON格式，等待 ${RETRY_DELAY}ms 后重试...`);
        await delay(RETRY_DELAY);
        continue;
      } else {
        console.warn(`⚠️ 已达到最大重试次数，返回最后一次的结果（可能不是JSON格式）`);
        console.log("最后一次返回的原始数据:", JSON.stringify(data, null, 2));
        return { response, data };
      }
    }
  }
  throw new Error("达到最大重试次数，无法获取有效数据");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file_url, city, fileName, mode, recordId, username } = body;

    if (!file_url || typeof file_url !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: "缺少 file_url 参数",
        },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "缺少用户名参数",
        },
        { status: 400 }
      );
    }

    // 验证URL格式
    try {
      const url = new URL(file_url);
      // 确保是 http 或 https 协议
      if (!['http:', 'https:'].includes(url.protocol)) {
        return NextResponse.json(
          {
            success: false,
            message: "file_url 必须是 http 或 https 协议",
          },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          message: "file_url 格式不正确",
        },
        { status: 400 }
      );
    }

    const cozeToken = getCozeToken(request);

    console.log("标准对比API调用参数:", {
      file_url,
      city,
      fileName,
      mode,
      recordId,
      workflow_id: WORKFLOW_ID,
      hasCity: !!city,
      hasFileName: !!fileName,
    });

    const { response, data } = await callCozeWorkflow(
      cozeToken,
      file_url
    );

    console.log("扣子工作流API - 原始返回数据:", {
      status: response.status,
      statusText: response.statusText,
      hasData: !!data.data,
      dataType: typeof data.data,
      fullData: JSON.stringify(data, null, 2),
    });

    let structuredData = null;
    let rawContent = null;
    let isJsonFormat = false;

    try {
      const extractedContent = extractContent(data);
      isJsonFormat = isValidJsonFormat(extractedContent);

      if (isJsonFormat) {
        structuredData = typeof extractedContent === 'string' ? JSON.parse(extractedContent) : extractedContent;
        console.log("检测到JSON格式的结构化数据:", {
          isArray: Array.isArray(structuredData),
          length: Array.isArray(structuredData) ? structuredData.length : 0,
          firstItem: Array.isArray(structuredData) && structuredData.length > 0 ? structuredData[0] : null,
        });
      } else {
        rawContent = typeof extractedContent === 'string' ? extractedContent : JSON.stringify(extractedContent, null, 2);
      }

      console.log("数据解析结果:", {
        isJsonFormat,
        hasStructuredData: !!structuredData,
        structuredDataLength: Array.isArray(structuredData) ? structuredData.length : 0,
        rawContentLength: rawContent?.length,
      });
    } catch (parseError: any) {
      console.error("解析数据失败:", {
        error: parseError.message,
        rawData: data.data,
        stack: parseError.stack,
      });
      rawContent = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
    }

    // 如果没有结构化数据，返回错误
    if (!structuredData && !rawContent) {
      return NextResponse.json(
        {
          success: false,
          message: "无法解析返回数据",
          raw_data: data.data,
        },
        { status: 500 }
      );
    }

    const result: any = {
      success: true,
      data: rawContent || structuredData || data.data || data,
      structured: structuredData,
      isJsonFormat,
      execute_id: data.execute_id,
      debug_url: data.debug_url,
      raw_data: data.data,
      rawCozeResponse: data, // 保存完整的原始Coze API返回数据
    };

    // 如果提供了 city 和 fileName，保存到数据库
    console.log("准备保存到数据库 - 参数检查:", {
      hasCity: !!city,
      city: city || "(空)",
      hasFileName: !!fileName,
      fileName: fileName || "(空)",
      hasFileUrl: !!file_url,
      file_url: file_url || "(空)",
      mode,
      recordId,
      willSave: !!(city && fileName && file_url),
    });

    if (city && fileName && file_url) {
      console.log("开始保存到数据库...");
      try {
        const db = getDatabase();
        console.log("数据库连接成功");
        
        const getBeijingTime = () => {
          const now = new Date();
          const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
          return beijingTime.toISOString();
        };

        let updateSuccess = false;
        
        if (mode === "overwrite" && recordId) {
          // 覆盖模式：更新现有记录
          console.log("覆盖模式 - 更新记录:", { recordId });
          
          // 先查询记录，验证是否属于当前用户
          const recordResult: any = await db
            .collection(COLLECTION_NAME)
            .doc(recordId)
            .get();

          if (typeof recordResult.code === 'string' || !recordResult.data || recordResult.data.length === 0) {
            console.error("❌ 记录不存在:", { recordId });
            // 记录不存在，继续执行创建模式
          } else {
            const record = recordResult.data[0];
            if (record.username !== username) {
              console.error("❌ 无权更新此记录:", { recordId, recordUsername: record.username, currentUsername: username });
              // 无权更新，继续执行创建模式
            } else {
              // 验证通过，执行更新
              const updateData: any = {
                city,
                fileName,
                fileUrl: file_url,
                standardItems: structuredData ? JSON.stringify(structuredData) : null,
                rawCozeResponse: JSON.stringify(data),
                add_time: getBeijingTime(),
                isVerified: false, // 重置审核状态
                updateTime: new Date().toISOString(),
              };

              console.log("更新数据:", {
                _id: recordId,
                city,
                fileName,
                fileUrl: file_url,
                hasStandardItems: !!structuredData,
                standardItemsLength: Array.isArray(structuredData) ? structuredData.length : 0,
              });

              const updateResult: any = await db.collection(COLLECTION_NAME).doc(recordId).update(updateData);
          
              console.log("更新结果:", updateResult);
              
              if (typeof updateResult.code === 'string') {
                console.error("❌ 更新记录失败:", {
                  code: updateResult.code,
                  message: updateResult.message,
                  result: updateResult,
                });
              } else {
                console.log("✅ 数据库更新成功:", { 
                  _id: recordId,
                  updated: updateResult.updated || 0,
                });
                result._id = recordId; // 返回记录ID
                updateSuccess = true; // 标记更新成功
              }
            }
          }
        }
        
        // 如果更新失败或没有 recordId，执行创建模式
        if (!updateSuccess) {
          // 创建模式：新建记录
          console.log("创建模式 - 新建记录");
          const record: any = {
            city,
            fileName,
            fileUrl: file_url,
            standardItems: structuredData ? JSON.stringify(structuredData) : null,
            status: "done",
            rawCozeResponse: JSON.stringify(data),
            add_time: getBeijingTime(),
            isVerified: false,
            username, // 保存用户名
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          };

          console.log("创建记录数据:", {
            city,
            fileName,
            fileUrl: file_url,
            hasStandardItems: !!structuredData,
            standardItemsLength: Array.isArray(structuredData) ? structuredData.length : 0,
            add_time: record.add_time,
          });

          const saveResult: any = await db.collection(COLLECTION_NAME).add(record);
          
          console.log("保存结果:", saveResult);
          
          if (typeof saveResult.code === 'string') {
            console.error("❌ 创建记录失败:", {
              code: saveResult.code,
              message: saveResult.message,
              result: saveResult,
            });
          } else {
            const _id = saveResult.id || saveResult._id || saveResult.ids?.[0];
            if (_id) {
              console.log("✅ 数据库保存成功:", { 
                _id,
                collection: COLLECTION_NAME,
              });
              result._id = _id; // 返回记录ID
            } else {
              console.error("❌ 保存成功但未返回ID:", saveResult);
            }
          }
        }
      } catch (dbError: any) {
        console.error("❌ 保存到数据库异常:", {
          error: dbError.message,
          stack: dbError.stack,
          errorDetails: dbError,
        });
        // 数据库保存失败不影响API返回，只记录错误
      }
    } else {
      console.warn("⚠️ 跳过数据库保存 - 缺少必要参数:", {
        city: city || "(空)",
        fileName: fileName || "(空)",
        file_url: file_url || "(空)",
      });
    }

    console.log("标准对比API - 处理后的返回数据:", {
      success: result.success,
      hasData: !!result.data,
      hasStructuredData: !!result.structured,
      isJsonFormat: result.isJsonFormat,
      structuredDataLength: Array.isArray(result.structured) ? result.structured.length : 0,
      executeId: result.execute_id,
      debugUrl: result.debug_url,
      savedToDB: !!(city && fileName && file_url),
      recordId: (result as any)._id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("标准对比API错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "对比失败，请稍后重试",
        error_details: error.message,
        error_stack: error.stack,
      },
      { status: 500 }
    );
  }
}

