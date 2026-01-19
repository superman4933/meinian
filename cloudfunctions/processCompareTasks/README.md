# 政策对比任务处理云函数

## 功能说明

这个云函数用于异步处理政策对比任务。它会定时扫描数据库中的待处理任务，调用扣子API进行对比，并更新任务状态。

## 工作流程

1. **定时触发**：每1分钟执行一次（cron: `0 */1 * * * * *`）
2. **查询任务**：查找状态为 `pending` 或 `retrying` 的任务（最多5个）
3. **处理任务**：
   - 更新状态为 `processing`
   - 调用扣子API进行对比
   - 保存结果到数据库
   - 更新状态为 `done` 或 `error`
4. **重试机制**：失败的任务会自动重试（最多3次）

## 配置

### 环境变量

- `COZE_API_TOKEN`: 扣子API Token（已在创建时配置）

### 参数配置

- `MAX_CONCURRENT_TASKS`: 每次最多处理的任务数（默认5）
- `MAX_TASK_RETRIES`: 任务最大重试次数（默认3）
- `MAX_RETRIES`: 扣子API调用最大重试次数（默认5）
- `RETRY_DELAY`: 重试延迟（默认2000ms）

## 数据库字段

任务记录需要包含以下字段：

- `status`: 任务状态（pending, processing, done, error, retrying）
- `retryCount`: 重试次数
- `maxRetries`: 最大重试次数
- `nextRetryTime`: 下次重试时间
- `startedAt`: 开始处理时间
- `completedAt`: 完成时间
- `errorMessage`: 错误信息
- `comparisonResult`: 对比结果
- `comparisonStructured`: 结构化对比结果
- `isJsonFormat`: 是否为JSON格式

## 部署

云函数已通过MCP工具部署，如需更新代码：

```bash
# 使用MCP工具更新代码
# 或使用腾讯云CLI
tcb fn code update processCompareTasks --code-dir cloudfunctions/processCompareTasks
```

## 监控

可以通过腾讯云控制台查看：
- 函数执行日志
- 执行次数和成功率
- 错误信息

## 注意事项

1. 定时触发器配置为每1分钟执行一次，可根据实际需求调整
2. 每次最多处理5个任务，避免并发过多
3. 任务失败后会自动重试，最多重试3次
4. 扣子API调用失败会重试，最多重试5次




