import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";

const WORKFLOW_ID = "7588132283023786047";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file1_id, file2_id, prompt } = body;

    if (!file1_id || !file2_id) {
      return NextResponse.json(
        { success: false, message: "缺少文件ID" },
        { status: 400 }
      );
    }

    // 获取扣子API Token（优先从请求头读取，如果没有则使用默认值）
    const tokenFromHeader = request.headers.get("x-coze-token");
    const cozeToken = tokenFromHeader || getCozeToken(request);

    // 记录请求参数
    const requestBody = {
      workflow_id: WORKFLOW_ID,
      parameters: {
        oldFile: JSON.stringify({ file_id: file1_id }),
        newFile: JSON.stringify({ file_id: file2_id }),
        prompt: prompt || "请分析这两个文件的内容差异",
      },
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log("调用扣子工作流API - 请求参数:", {
        file1_id,
        file2_id,
        prompt,
        requestBody: JSON.stringify(requestBody, null, 2),
      });
    }

    // 调用扣子工作流API
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
      if (process.env.NODE_ENV === 'development') {
        console.error("扣子工作流API返回非JSON响应:", {
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }
      
      return NextResponse.json(
        {
          success: false,
          message: `扣子API返回错误 (${response.status}): ${response.statusText}`,
          error_source: "扣子API",
          status: response.status,
          response_body: text,
        },
        { status: response.status }
      );
    }

    // 记录扣子API的原始返回数据（仅开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log("扣子工作流API - 原始返回数据:", {
        status: response.status,
        statusText: response.statusText,
        rawResponse: JSON.stringify(data, null, 2),
        allKeys: Object.keys(data),
        hasData: !!data.data,
        hasExecuteId: !!data.execute_id,
        hasDebugUrl: !!data.debug_url,
      });
    }

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.error("扣子工作流API调用失败:", {
          status: response.status,
          statusText: response.statusText,
          errorData: data,
        });
      }
      
      return NextResponse.json(
        {
          success: false,
          message: `扣子API返回错误: ${data.message || data.error || response.statusText || "未知错误"}`,
          error_source: "扣子API",
          error_code: data.code || data.error_code,
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    // 解析返回数据，尝试提取JSON格式的结构化数据或markdown内容
    let structuredData = null;
    let markdownContent = null;
    let rawContent = null;
    let isJsonFormat = false;
    
    try {
      // 第一步：从data.data中提取内容
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
      } else if (data.data && typeof data.data === 'object') {
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

      // 第二步：检查extractedContent是否是JSON格式的结构化数据
      if (typeof extractedContent === 'string') {
        // 尝试解析为JSON
        try {
          const parsedJson = JSON.parse(extractedContent);
          // 检查是否包含预期的JSON结构字段
          if (
            parsedJson &&
            typeof parsedJson === 'object' &&
            (parsedJson.summary !== undefined ||
             parsedJson.added !== undefined ||
             parsedJson.modified !== undefined ||
             parsedJson.deleted !== undefined ||
             parsedJson.statistics !== undefined ||
             parsedJson.detailed !== undefined)
          ) {
            structuredData = parsedJson;
            isJsonFormat = true;
            markdownContent = parsedJson.detailed || null;
            if (process.env.NODE_ENV === 'development') {
              console.log("检测到JSON格式的结构化数据:", {
                hasSummary: !!parsedJson.summary,
                hasAdded: !!parsedJson.added,
                hasModified: !!parsedJson.modified,
                hasDeleted: !!parsedJson.deleted,
                hasStatistics: !!parsedJson.statistics,
                hasDetailed: !!parsedJson.detailed,
              });
            }
          } else {
            // 不是预期的JSON结构，当作markdown处理
            markdownContent = extractedContent;
            rawContent = extractedContent;
          }
        } catch (e) {
          // 不是JSON格式，当作markdown处理
          markdownContent = extractedContent;
          rawContent = extractedContent;
        }
      } else if (typeof extractedContent === 'object' && extractedContent !== null) {
        // 已经是对象，检查是否是预期的JSON结构
        if (
          extractedContent.summary !== undefined ||
          extractedContent.added !== undefined ||
          extractedContent.modified !== undefined ||
          extractedContent.deleted !== undefined ||
          extractedContent.statistics !== undefined ||
          extractedContent.detailed !== undefined
        ) {
          structuredData = extractedContent;
          isJsonFormat = true;
          markdownContent = extractedContent.detailed || null;
          if (process.env.NODE_ENV === 'development') {
            console.log("检测到JSON格式的结构化数据（对象）:", {
              hasSummary: !!extractedContent.summary,
              hasAdded: !!extractedContent.added,
              hasModified: !!extractedContent.modified,
              hasDeleted: !!extractedContent.deleted,
              hasStatistics: !!extractedContent.statistics,
              hasDetailed: !!extractedContent.detailed,
            });
          }
        } else {
          // 不是预期的JSON结构
          rawContent = JSON.stringify(extractedContent);
          markdownContent = rawContent;
        }
      } else {
        rawContent = extractedContent;
        markdownContent = extractedContent;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log("数据解析结果:", {
          isJsonFormat,
          hasStructuredData: !!structuredData,
          hasMarkdown: !!markdownContent,
          markdownLength: markdownContent?.length,
          markdownPreview: markdownContent?.substring(0, 200),
        });
      }
    } catch (parseError: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error("解析数据失败:", {
          error: parseError.message,
          rawData: data.data,
        });
      }
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
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log("扣子工作流API - 处理后的返回数据:", {
        success: result.success,
        hasData: !!result.data,
        hasMarkdown: !!result.markdown,
        dataType: typeof result.data,
        executeId: result.execute_id,
        debugUrl: result.debug_url,
        fullResult: JSON.stringify(result, null, 2),
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Compare error:", error);
    }
    return NextResponse.json(
      {
        success: false,
        message: error.message || "对比失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

