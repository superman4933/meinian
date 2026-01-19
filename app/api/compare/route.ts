import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";
import { jsonrepair } from "jsonrepair";

const WORKFLOW_ID = "7588132283023786047";
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

  // 检查是否包含预期的JSON结构字段
  if (typeof extractedContent === 'string') {
    // 如果是字符串，尝试解析为JSON
    try {
      const parsedJson = JSON.parse(extractedContent);
      if (
        parsedJson &&
        typeof parsedJson === 'object' &&
        !Array.isArray(parsedJson) &&
        (parsedJson.summary !== undefined ||
         parsedJson.added !== undefined ||
         parsedJson.modified !== undefined ||
         parsedJson.deleted !== undefined ||
         parsedJson.statistics !== undefined ||
         parsedJson.detailed !== undefined)
      ) {
        return true;
      }
    } catch (e) {
      return false;
    }
  } else if (typeof extractedContent === 'object' && extractedContent !== null && !Array.isArray(extractedContent)) {
    // 如果是对象（不是数组），检查是否包含预期字段
    if (
      extractedContent.summary !== undefined ||
      extractedContent.added !== undefined ||
      extractedContent.modified !== undefined ||
      extractedContent.deleted !== undefined ||
      extractedContent.statistics !== undefined ||
      extractedContent.detailed !== undefined
    ) {
      return true;
    }
  }

  return false;
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 尝试修复JSON格式
function tryRepairJson(content: string, attempt: number): { success: boolean; repaired?: any; error?: string } {
  if (typeof content !== 'string' || !content.trim()) {
    return { success: false, error: '内容不是字符串或为空' };
  }

  try {
    // 尝试使用 jsonrepair 修复
    const repaired = jsonrepair(content);
    const parsed = JSON.parse(repaired);
    
    console.log(`🔧 JSON修复成功 (第 ${attempt} 次尝试):`, {
      originalLength: content.length,
      repairedLength: repaired.length,
      isObject: typeof parsed === 'object',
      isArray: Array.isArray(parsed),
      keys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).slice(0, 10) : [],
    });

    return { success: true, repaired: parsed };
  } catch (error: any) {
    console.warn(`⚠️ JSON修复失败 (第 ${attempt} 次尝试):`, {
      error: error.message,
      contentPreview: content.substring(0, 200),
      contentLength: content.length,
    });
    return { success: false, error: error.message };
  }
}

// 调用扣子工作流API（带重试）
async function callCozeWorkflow(
  cozeToken: string,
  file1_url: string,
  file2_url: string,
  oldFileName: string,
  newFileName: string
): Promise<{ response: Response; data: any }> {
  const requestBody = {
    workflow_id: WORKFLOW_ID,
    parameters: {
      oldFile: file1_url,
      newFile: file2_url,
      oldFileName: oldFileName,
      newFileName: newFileName,
    },
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`调用扣子工作流API - 第 ${attempt}/${MAX_RETRIES} 次尝试:`, {
      file1_url,
      file2_url,
      oldFileName,
      newFileName,
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
      // 如果响应不是JSON格式
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

    // 检查HTTP状态码
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

    // 检查返回的数据是否是有效的JSON格式
    const extractedContent = extractContent(data);
    let isValid = isValidJsonFormat(extractedContent);
    console.log(`数据格式检查 (第 ${attempt}/${MAX_RETRIES} 次):`, {
      isValid,
      hasData: !!data.data,
      dataType: typeof data.data,
      extractedContentType: typeof extractedContent,
      isArray: Array.isArray(extractedContent),
    });

    // 如果格式无效，尝试修复JSON
    if (!isValid && typeof extractedContent === 'string' && extractedContent.trim().length > 0) {
      console.log(`🔧 尝试修复JSON格式 (第 ${attempt}/${MAX_RETRIES} 次)...`);
      const repairResult = tryRepairJson(extractedContent, attempt);
      
      if (repairResult.success && repairResult.repaired) {
        // 修复成功，验证修复后的数据是否符合预期格式
        const repairedIsValid = isValidJsonFormat(repairResult.repaired);
        console.log(`修复后格式验证:`, {
          isValid: repairedIsValid,
          repairedType: typeof repairResult.repaired,
          isArray: Array.isArray(repairResult.repaired),
        });

        if (repairedIsValid) {
          // 修复成功且验证通过，更新data.data为修复后的数据
          console.log(`✅ JSON修复成功并通过验证 (第 ${attempt}/${MAX_RETRIES} 次)`);
          // 将修复后的数据更新到原始数据结构中
          if (data.data && typeof data.data === 'string') {
            try {
              const parsed = JSON.parse(data.data);
              if (parsed.data && typeof parsed.data === 'string') {
                // 更新内层数据
                data.data = JSON.stringify({
                  ...parsed,
                  data: JSON.stringify(repairResult.repaired)
                });
              } else {
                data.data = JSON.stringify(repairResult.repaired);
              }
            } catch (e) {
              data.data = JSON.stringify(repairResult.repaired);
            }
          } else {
            data.data = JSON.stringify(repairResult.repaired);
          }
          isValid = true;
        } else {
          console.warn(`⚠️ JSON修复成功但格式验证未通过 (第 ${attempt}/${MAX_RETRIES} 次)`);
        }
      } else {
        console.warn(`⚠️ JSON修复失败 (第 ${attempt}/${MAX_RETRIES} 次):`, {
          error: repairResult.error,
          extractedContentPreview: extractedContent.substring(0, 200),
        });
      }
    }

    if (isValid) {
      console.log(`✅ 成功获取JSON格式数据 (第 ${attempt}/${MAX_RETRIES} 次)`);
      return { response, data };
    } else {
      if (attempt < MAX_RETRIES) {
        console.warn(`⚠️ 返回数据不是预期的JSON格式，等待 ${RETRY_DELAY}ms 后重试...`);
        console.warn(`当前返回数据预览:`, {
          hasData: !!data.data,
          dataType: typeof data.data,
          dataPreview: typeof data.data === 'string' 
            ? data.data.substring(0, 200) 
            : JSON.stringify(data.data).substring(0, 200),
          extractedContentType: typeof extractedContent,
          extractedContentPreview: typeof extractedContent === 'string'
            ? extractedContent.substring(0, 200)
            : JSON.stringify(extractedContent).substring(0, 200),
        });
        await delay(RETRY_DELAY);
        continue;
      } else {
        console.warn(`⚠️ 已达到最大重试次数，返回最后一次的结果（可能不是JSON格式）`);
        console.warn(`最后一次返回的完整数据:`, {
          status: response.status,
          statusText: response.statusText,
          hasData: !!data.data,
          dataType: typeof data.data,
          dataContent: typeof data.data === 'string' 
            ? data.data 
            : JSON.stringify(data.data, null, 2),
          extractedContent: typeof extractedContent === 'string'
            ? extractedContent
            : JSON.stringify(extractedContent, null, 2),
          fullResponse: JSON.stringify(data, null, 2),
        });
        return { response, data };
      }
    }
  }

  throw new Error("达到最大重试次数，无法获取有效数据");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file1_url, file2_url, oldFileName, newFileName } = body;

    if (!file1_url || !file2_url) {
      return NextResponse.json(
        { success: false, message: "缺少文件URL" },
        { status: 400 }
      );
    }

    if (!oldFileName || !newFileName) {
      return NextResponse.json(
        { success: false, message: "缺少文件名参数" },
        { status: 400 }
      );
    }

    // 验证URL格式
    if (!file1_url.startsWith('http://') && !file1_url.startsWith('https://')) {
      return NextResponse.json(
        { success: false, message: "文件URL格式不正确" },
        { status: 400 }
      );
    }
    if (!file2_url.startsWith('http://') && !file2_url.startsWith('https://')) {
      return NextResponse.json(
        { success: false, message: "文件URL格式不正确" },
        { status: 400 }
      );
    }

    // 获取扣子API Token（优先从请求头读取，如果没有则使用默认值）
    const tokenFromHeader = request.headers.get("x-coze-token");
    const cozeToken = tokenFromHeader || getCozeToken(request);

    // 调用扣子工作流API（带重试）
    const { response, data } = await callCozeWorkflow(
      cozeToken,
      file1_url,
      file2_url,
      oldFileName,
      newFileName
    );

    // 记录扣子API的原始返回数据
    console.log("扣子工作流API - 原始返回数据:", {
      status: response.status,
      statusText: response.statusText,
      rawResponse: JSON.stringify(data, null, 2),
      allKeys: Object.keys(data),
      hasData: !!data.data,
      hasExecuteId: !!data.execute_id,
      hasDebugUrl: !!data.debug_url,
    });

    // 解析返回数据，尝试提取JSON格式的结构化数据或markdown内容
    let structuredData = null;
    let markdownContent = null;
    let rawContent = null;
    let isJsonFormat = false;
    
    try {
      // 第一步：从data.data中提取内容（使用统一的提取函数）
      const extractedContent = extractContent(data);

      // 第二步：检查extractedContent是否是JSON格式的结构化数据
      if (isValidJsonFormat(extractedContent)) {
        // 是有效的JSON格式，提取结构化数据
        let parsedJson = extractedContent;
        
        // 如果是字符串，需要解析
        if (typeof extractedContent === 'string') {
          try {
            parsedJson = JSON.parse(extractedContent);
          } catch (e) {
            // 理论上不应该到这里，因为 isValidJsonFormat 已经验证过
            console.warn("JSON格式验证通过但解析失败:", e);
            parsedJson = extractedContent;
          }
        }
        
        structuredData = parsedJson;
        isJsonFormat = true;
        markdownContent = parsedJson.detailed || null;
        console.log("检测到JSON格式的结构化数据:", {
          hasSummary: !!parsedJson.summary,
          hasAdded: !!parsedJson.added,
          hasModified: !!parsedJson.modified,
          hasDeleted: !!parsedJson.deleted,
          hasStatistics: !!parsedJson.statistics,
          hasDetailed: !!parsedJson.detailed,
        });
      } else {
        // 不是预期的JSON结构，当作markdown处理
        if (typeof extractedContent === 'string') {
          markdownContent = extractedContent;
          rawContent = extractedContent;
        } else if (typeof extractedContent === 'object' && extractedContent !== null) {
          rawContent = JSON.stringify(extractedContent);
          markdownContent = rawContent;
        } else {
          rawContent = extractedContent;
          markdownContent = extractedContent;
        }
      }
      
      console.log("数据解析结果:", {
        isJsonFormat,
        hasStructuredData: !!structuredData,
        hasMarkdown: !!markdownContent,
        markdownLength: markdownContent?.length,
        markdownPreview: markdownContent?.substring(0, 200),
      });
    } catch (parseError: any) {
      console.error("解析数据失败:", {
        error: parseError.message,
        rawData: data.data,
      });
      // 如果解析失败，使用原始数据
      rawContent = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
      markdownContent = rawContent;
    }

    // 记录成功返回的数据
    const result = {
      success: true,
      data: rawContent || markdownContent || data.data || data,
      markdown: markdownContent, // markdown内容（可能是detailed字段或原始内容）
      structured: structuredData, // JSON格式的结构化数据（如果存在）
      isJsonFormat, // 标识是否是JSON格式
      execute_id: data.execute_id,
      debug_url: data.debug_url,
      raw_data: data.data, // 保留原始数据用于调试
      rawCozeResponse: data, // 保存完整的扣子API原始返回对象（用于保存到数据库）
    };
    
    console.log("扣子工作流API - 处理后的返回数据:", {
      success: result.success,
      hasData: !!result.data,
      hasMarkdown: !!result.markdown,
      dataType: typeof result.data,
      executeId: result.execute_id,
      debugUrl: result.debug_url,
      fullResult: JSON.stringify(result, null, 2),
    });

    // 详细输出结构化数据（如果存在）
    if (structuredData) {
      console.log("结构化数据详情:", {
        hasSummary: !!structuredData.summary,
        summaryLength: structuredData.summary?.length || 0,
        summaryPreview: structuredData.summary?.substring(0, 200),
        hasAdded: !!structuredData.added,
        addedCount: Array.isArray(structuredData.added) ? structuredData.added.length : 0,
        addedPreview: Array.isArray(structuredData.added) ? structuredData.added.slice(0, 3) : null,
        hasModified: !!structuredData.modified,
        modifiedCount: Array.isArray(structuredData.modified) ? structuredData.modified.length : 0,
        modifiedPreview: Array.isArray(structuredData.modified) ? structuredData.modified.slice(0, 3) : null,
        hasDeleted: !!structuredData.deleted,
        deletedCount: Array.isArray(structuredData.deleted) ? structuredData.deleted.length : 0,
        deletedPreview: Array.isArray(structuredData.deleted) ? structuredData.deleted.slice(0, 3) : null,
        hasStatistics: !!structuredData.statistics,
        statistics: structuredData.statistics,
        hasDetailed: !!structuredData.detailed,
        detailedLength: structuredData.detailed?.length || 0,
        detailedPreview: structuredData.detailed?.substring(0, 300),
        fullStructuredData: JSON.stringify(structuredData, null, 2),
      });
    }

    // 输出最终返回给前端的数据
    console.log("========== 接口返回数据 ==========");
    console.log("返回状态:", result.success ? "成功" : "失败");
    console.log("是否为JSON格式:", isJsonFormat ? "是" : "否");
    console.log("执行ID:", result.execute_id);
    console.log("调试URL:", result.debug_url);
    console.log("数据字段类型:", typeof result.data);
    console.log("数据字段长度:", typeof result.data === 'string' ? result.data.length : "N/A");
    console.log("Markdown字段:", result.markdown ? `存在 (${result.markdown.length} 字符)` : "不存在");
    console.log("结构化数据字段:", result.structured ? "存在" : "不存在");
    console.log("原始数据字段:", result.raw_data ? "存在" : "不存在");
    console.log("完整返回数据 (JSON):", JSON.stringify(result, null, 2));
    console.log("===================================");

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("========== 接口返回错误 ==========");
    console.error("错误类型:", error.constructor.name);
    console.error("错误消息:", error.message);
    console.error("错误堆栈:", error.stack);
    console.error("完整错误对象:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    const errorResponse = {
      success: false,
      message: error.message || "对比失败，请稍后重试",
    };
    
    console.error("返回的错误响应:", JSON.stringify(errorResponse, null, 2));
    console.error("===================================");
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

