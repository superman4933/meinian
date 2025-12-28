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
        file1: JSON.stringify({ file_id: file1_id }),
        file2: JSON.stringify({ file_id: file2_id }),
        prompt: prompt || "请分析这两个文件的内容差异",
      },
    };
    
    console.log("调用扣子工作流API - 请求参数:", {
      file1_id,
      file2_id,
      prompt,
      requestBody: JSON.stringify(requestBody, null, 2),
    });

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
      console.error("扣子工作流API返回非JSON响应:", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      
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

    if (!response.ok) {
      console.error("扣子工作流API调用失败:", {
        status: response.status,
        statusText: response.statusText,
        errorData: data,
      });
      
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

    // 解析返回数据，提取 markdown 内容
    let markdownContent = null;
    let parsedData = null;
    
    try {
      // data.data 是一个 JSON 字符串，需要解析
      if (data.data && typeof data.data === 'string') {
        parsedData = JSON.parse(data.data);
        console.log("解析后的 data.data:", {
          parsedData,
          hasData: !!parsedData.data,
          contentType: parsedData.content_type,
        });
        
        // 如果 parsedData.data 还是字符串，继续解析
        if (parsedData.data && typeof parsedData.data === 'string') {
          try {
            const innerData = JSON.parse(parsedData.data);
            markdownContent = innerData.data || parsedData.data;
          } catch (e) {
            // 如果解析失败，说明 parsedData.data 就是 markdown 内容
            markdownContent = parsedData.data;
          }
        } else {
          markdownContent = parsedData.data;
        }
      } else if (data.data && typeof data.data === 'object') {
        // 如果 data.data 已经是对象
        if (data.data.data && typeof data.data.data === 'string') {
          try {
            const innerData = JSON.parse(data.data.data);
            markdownContent = innerData.data || data.data.data;
          } catch (e) {
            markdownContent = data.data.data;
          }
        } else {
          markdownContent = data.data.data || data.data;
        }
      }
      
      console.log("提取的 markdown 内容:", {
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
      markdownContent = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
    }

    // 记录成功返回的数据
    const result = {
      success: true,
      data: markdownContent || data.data || data,
      markdown: markdownContent, // 单独提供 markdown 字段
      execute_id: data.execute_id,
      debug_url: data.debug_url,
      raw_data: data.data, // 保留原始数据用于调试
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

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Compare error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "对比失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

