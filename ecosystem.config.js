/**
 * PM2 进程管理器配置文件
 * 用于服务器部署时管理 Node.js 应用
 * 
 * 使用方法：
 * 1. 安装 PM2: npm install -g pm2
 * 2. 启动应用: pm2 start ecosystem.config.js
 * 3. 查看状态: pm2 status
 * 4. 查看日志: pm2 logs meinian
 * 5. 停止应用: pm2 stop meinian
 * 6. 重启应用: pm2 restart meinian
 */

module.exports = {
  apps: [{
    name: 'meinian',
    script: 'npm',
    args: 'start',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      // 腾讯云开发配置
      TCB_ENV_ID: 'pet-8g5ohyrp269f409e-9bua741dcc7',
      TCB_SECRET_ID: '你的SecretID',
      TCB_SECRET_KEY: '你的SecretKey',
      // 扣子API配置（可选）
      COZE_API_TOKEN: '你的扣子API Token',
    },
    // 日志配置
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // 自动重启配置
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
};

