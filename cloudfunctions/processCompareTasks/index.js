const cloudbase = require("@cloudbase/node-sdk");

// 配置
const WORKFLOW_ID = "7588132283023786047";
const MAX_RETRIES = 5; // 最大重试次数
const RETRY_DELAY = 2000; // 重试延迟（毫秒）
const MAX_CONCURRENT_TASKS = 5; // 每次最多处理的任务数
const MAX_TASK_RETRIES = 3; // 任务最大重试次数

// 初始化SDK（云函数环境自动使用当前环境）
const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const COLLECTION_NAME = "policy_compare_records";

// 延迟函数
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 从扣子API返回的数据中提取内容
function extractContent(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  let extractedContent = null;

  if (data.data && typeof data.data === "string") {
    try {
      const parsed = JSON.parse(data.data);
      if (parsed.data && typeof parsed.data === "string") {
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
  } else if (
    data.data &&
    typeof data.data === "object" &&
    !Array.isArray(data.data)
  ) {
    if (data.data.data && typeof data.data.data === "string") {
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

// 检查提取的内容是否是有效的JSON格式
function isValidJsonFormat(extractedContent) {
  if (!extractedContent) {
    return false;
  }

  if (typeof extractedContent === "string") {
    try {
      const parsedJson = JSON.parse(extractedContent);
      if (
        parsedJson &&
        typeof parsedJson === "object" &&
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
  } else if (
    typeof extractedContent === "object" &&
    extractedContent !== null &&
    !Array.isArray(extractedContent)
  ) {
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

// 调用扣子工作流API（带重试）
async function callCozeWorkflow(
  cozeToken,
  file1_url,
  file2_url,
  oldFileName,
  newFileName
) {
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
    console.log(`调用扣子工作流API - 第 ${attempt}/${MAX_RETRIES} 次尝试`);

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
        throw new Error(
          `扣子API返回非JSON响应 (${response.status}): ${response.statusText}`
        );
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
        throw new Error(
          `扣子API返回错误: ${data.message || data.error || response.statusText || "未知错误"}`
        );
      }
    }

    const extractedContent = extractContent(data);
    const isValid = isValidJsonFormat(extractedContent);

    if (isValid) {
      console.log(`✅ 成功获取JSON格式数据 (第 ${attempt}/${MAX_RETRIES} 次)`);
      return { response, data };
    } else {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `⚠️ 返回数据不是预期的JSON格式，等待 ${RETRY_DELAY}ms 后重试...`
        );
        await delay(RETRY_DELAY);
        continue;
      } else {
        console.warn(`⚠️ 已达到最大重试次数，返回最后一次的结果`);
        return { response, data };
      }
    }
  }

  throw new Error("达到最大重试次数，无法获取有效数据");
}

// 处理单个对比任务
async function processTask(task) {
  const taskId = task._id;
  console.log(`开始处理任务: ${taskId}, 公司: ${task.company}`);

  try {
    // 更新任务状态为 processing
    await db
      .collection(COLLECTION_NAME)
      .doc(taskId)
      .update({
        status: "processing",
        startedAt: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      });

    // 获取扣子Token（从环境变量或默认值）
    const cozeToken =
      process.env.COZE_API_TOKEN ||
      "sat_iVFZ9QcGxPajVuiZD6o89MGOZ9hiQL2rTGMIzUAxGy9rBvwegpaZDEqzeyoGY4Ic";

    // 调用扣子工作流API
    const { response, data } = await callCozeWorkflow(
      cozeToken,
      task.oldFileUrl,
      task.newFileUrl,
      task.oldFileName,
      task.newFileName
    );

    // 解析返回数据
    let structuredData = null;
    let markdownContent = null;
    let rawContent = null;
    let isJsonFormat = false;

    try {
      const extractedContent = extractContent(data);

      if (isValidJsonFormat(extractedContent)) {
        let parsedJson = extractedContent;
        if (typeof extractedContent === "string") {
          try {
            parsedJson = JSON.parse(extractedContent);
          } catch (e) {
            parsedJson = extractedContent;
          }
        }
        structuredData = parsedJson;
        isJsonFormat = true;
        markdownContent = parsedJson.detailed || null;
      } else {
        if (typeof extractedContent === "string") {
          markdownContent = extractedContent;
          rawContent = extractedContent;
        } else if (typeof extractedContent === "object" && extractedContent !== null) {
          rawContent = JSON.stringify(extractedContent);
          markdownContent = rawContent;
        } else {
          rawContent = extractedContent;
          markdownContent = extractedContent;
        }
      }
    } catch (parseError) {
      console.error("解析数据失败:", parseError);
      rawContent =
        typeof data.data === "string" ? data.data : JSON.stringify(data.data);
      markdownContent = rawContent;
    }

    // 保存结果
    const resultContent = markdownContent || rawContent || data.data || "对比完成";
    const updateData = {
      status: "done",
      comparisonResult:
        typeof resultContent === "object"
          ? JSON.stringify(resultContent)
          : resultContent,
      comparisonStructured: structuredData
        ? JSON.stringify(structuredData)
        : null,
      isJsonFormat: isJsonFormat,
      completedAt: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      errorMessage: null,
    };

    await db.collection(COLLECTION_NAME).doc(taskId).update(updateData);

    console.log(`✅ 任务处理成功: ${taskId}`);
    return { success: true, taskId };
  } catch (error) {
    console.error(`❌ 任务处理失败: ${taskId}`, error);

    const retryCount = (task.retryCount || 0) + 1;
    const shouldRetry = retryCount < (task.maxRetries || MAX_TASK_RETRIES);

    const updateData = {
      status: shouldRetry ? "retrying" : "error",
      retryCount: retryCount,
      errorMessage: error.message || "处理失败",
      updateTime: new Date().toISOString(),
      // 如果重试，设置下次重试时间（30秒后）
      nextRetryTime: shouldRetry
        ? new Date(Date.now() + 30000).toISOString()
        : null,
    };

    await db.collection(COLLECTION_NAME).doc(taskId).update(updateData);

    return { success: false, taskId, error: error.message, shouldRetry };
  }
}

// 主函数
exports.main = async (event, context) => {
  console.log("开始执行对比任务处理...");

  try {
    // 查询待处理的任务
    // 条件：status = "pending" 或 (status = "retrying" 且 nextRetryTime <= 当前时间)
    const now = new Date().toISOString();
    const pendingTasks = await db
      .collection(COLLECTION_NAME)
      .where({
        $or: [
          { status: "pending" },
          {
            status: "retrying",
            nextRetryTime: db.command.lte(now),
          },
        ],
      })
      .orderBy("createTime", "asc")
      .limit(MAX_CONCURRENT_TASKS)
      .get();

    if (pendingTasks.code) {
      console.error("查询任务失败:", pendingTasks);
      return {
        code: -1,
        message: "查询任务失败",
        error: pendingTasks,
      };
    }

    const tasks = pendingTasks.data || [];
    console.log(`找到 ${tasks.length} 个待处理任务`);

    if (tasks.length === 0) {
      return {
        code: 0,
        message: "没有待处理的任务",
        processed: 0,
      };
    }

    // 并发处理任务
    const results = await Promise.allSettled(
      tasks.map((task) => processTask(task))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failCount = results.length - successCount;

    console.log(`任务处理完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);

    return {
      code: 0,
      message: "任务处理完成",
      processed: tasks.length,
      success: successCount,
      failed: failCount,
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : { error: r.reason }
      ),
    };
  } catch (error) {
    console.error("处理任务时发生错误:", error);
    return {
      code: -1,
      message: error.message || "处理任务时发生错误",
      error: error.stack,
    };
  }
};



