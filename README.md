# 政策文件对比系统

基于 Next.js 14 构建的政策文件对比系统，支持新年度和旧年度文件的对比分析。

## 技术栈

- **Next.js 14** - React 框架，使用 App Router
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **React 18** - UI 库

## 功能特性

- 📤 文件上传（新年度/旧年度文件）
- 📊 文件对比列表展示
- 🔍 对比详情预览
- 🎨 现代化 UI 设计

## 环境变量配置

### 本地开发

在项目根目录创建 `.env.local` 文件（已添加到 `.gitignore`，不会被提交）：

```env
# 腾讯云开发配置
TCB_ENV_ID=pet-8g5ohyrp269f409e-9bua741dcc7
TCB_SECRET_ID=你的SecretID
TCB_SECRET_KEY=你的SecretKey

# 扣子API配置（可选，有默认值）
COZE_API_TOKEN=你的扣子API Token
```

### 线上部署

根据不同的部署平台，配置方式如下：

#### Vercel 部署

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加以下环境变量：
   - `TCB_ENV_ID`
   - `TCB_SECRET_ID`
   - `TCB_SECRET_KEY`
   - `COZE_API_TOKEN`（可选）
5. 选择环境（Production、Preview、Development）
6. 点击 **Save**
7. 重新部署项目（Redeploy）

#### 其他平台（Docker、服务器等）

**Docker 部署：**
```dockerfile
# 在 Dockerfile 中或 docker-compose.yml 中配置
ENV TCB_ENV_ID=pet-8g5ohyrp269f409e-9bua741dcc7
ENV TCB_SECRET_ID=你的SecretID
ENV TCB_SECRET_KEY=你的SecretKey
```

**服务器部署：**
```bash
# 在服务器上创建 .env.local 文件
# 或使用 systemd service 配置环境变量
# 或使用 PM2 的 ecosystem.config.js
```

**PM2 配置示例（ecosystem.config.js）：**
```javascript
module.exports = {
  apps: [{
    name: 'meinian',
    script: 'npm',
    args: 'start',
    env: {
      TCB_ENV_ID: 'pet-8g5ohyrp269f409e-9bua741dcc7',
      TCB_SECRET_ID: '你的SecretID',
      TCB_SECRET_KEY: '你的SecretKey',
      COZE_API_TOKEN: '你的扣子API Token',
    }
  }]
}
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
.
├── app/
│   ├── layout.tsx      # 根布局
│   ├── page.tsx        # 首页
│   └── globals.css     # 全局样式
├── components/
│   ├── header.tsx      # 头部组件
│   ├── file-upload.tsx # 文件上传组件
│   ├── toolbar.tsx     # 工具栏组件
│   └── comparison-table.tsx # 对比表格组件
└── public/             # 静态资源
```

