# 云函数部署说明

## 当前状态

云函数 `processCompareTasks` 已经成功部署到腾讯云，包括：
- ✅ 函数代码已上传
- ✅ 定时触发器已配置（每1分钟执行一次）
- ✅ 环境变量已配置（COZE_API_TOKEN）
- ✅ 函数状态：Active（运行中）

## 如何更新代码

### 方法1：使用MCP工具（推荐）

如果修改了 `cloudfunctions/processCompareTasks/index.js` 文件，使用以下命令更新：

```bash
# 通过MCP工具更新（已在代码中自动调用）
# 工具会自动检测并上传最新代码
```

### 方法2：使用腾讯云CLI

```bash
# 安装腾讯云CLI（如果还没安装）
npm install -g @cloudbase/cli

# 登录
tcb login

# 更新云函数代码
tcb fn code update processCompareTasks --code-dir cloudfunctions/processCompareTasks
```

### 方法3：通过腾讯云控制台

1. 访问：https://tcb.cloud.tencent.com/dev?envId=pet-8g5ohyrp269f409e-9bua741dcc7#/scf
2. 找到 `processCompareTasks` 函数
3. 点击"编辑" → "上传代码"
4. 选择 `cloudfunctions/processCompareTasks` 目录
5. 点击"部署"

## 目录结构

```
cloudfunctions/
└── processCompareTasks/
    ├── index.js          # 主函数代码
    ├── package.json      # 依赖配置
    └── README.md         # 说明文档
```

## 注意事项

1. **不要上传 node_modules**：云函数会自动安装依赖
2. **package.json 必须存在**：用于指定依赖
3. **入口文件必须是 index.js**：handler 配置为 `index.main`
4. **环境变量**：通过控制台或MCP工具配置，不要硬编码

## 查看日志

### 通过MCP工具

```bash
# 查看函数日志列表
# 使用 getFunctionLogs 工具

# 查看详细日志
# 使用 getFunctionLogDetail 工具（需要 RequestId）
```

### 通过控制台

访问：https://tcb.cloud.tencent.com/dev?envId=pet-8g5ohyrp269f409e-9bua741dcc7#/scf/detail?id=processCompareTasks

## 测试云函数

### 手动触发测试

可以通过控制台手动触发云函数进行测试：
1. 进入函数详情页
2. 点击"测试"
3. 输入测试事件（可以为空）
4. 查看执行结果和日志

### 验证定时触发器

定时触发器每1分钟执行一次，可以通过以下方式验证：
1. 在数据库中创建一个 `status: "pending"` 的任务
2. 等待1-2分钟
3. 检查任务状态是否变为 `done` 或 `processing`
4. 查看云函数日志确认执行情况

## 常见问题

### Q: 代码更新后不生效？
A: 确保：
- 代码已成功上传（检查控制台）
- 函数状态为 Active
- 查看日志确认是否有错误

### Q: 定时触发器不执行？
A: 检查：
- 触发器状态是否为"已启用"
- Cron表达式是否正确：`0 */1 * * * * *`（每1分钟）
- 查看触发器日志

### Q: 如何修改定时频率？
A: 使用MCP工具或控制台修改触发器配置：
- 每30秒：`0,30 * * * * * *`
- 每5分钟：`0 */5 * * * * *`
- 每小时：`0 0 * * * * *`




