const path = require('path')

module.exports = {
  apps: [
    // ── WhatsApp Web (whatsapp-web.js + Puppeteer) ─────────────────────────
    {
      name: 'sofi-whatsapp',
      script: path.join(__dirname, 'whatsapp.js'),
      cwd: __dirname,
      interpreter: 'C:\\Users\\vinicius.felix\\AppData\\Local\\nodejs\\node.exe',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 8000,
      max_memory_restart: '1800M', // Chrome headless usa ~500MB
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(__dirname, 'logs', 'wa-error.log'),
      out_file: path.join(__dirname, 'logs', 'wa-out.log'),
      merge_logs: true,
    },
    // ── Relay SSE (porta 8079 — recebe webhooks e transmite ao browser) ────
    {
      name: 'sofi-relay',
      script: path.join(__dirname, 'relay.js'),
      cwd: __dirname,
      interpreter: 'C:\\Users\\vinicius.felix\\AppData\\Local\\nodejs\\node.exe',
      watch: false,
      autorestart: true,
      max_restarts: 30,
      min_uptime: '5s',
      restart_delay: 2000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(__dirname, 'logs', 'relay-error.log'),
      out_file: path.join(__dirname, 'logs', 'relay-out.log'),
      merge_logs: true,
    },
    // ── Túnel ngrok (porta 8079 → prankster-scored-giver.ngrok-free.dev) ───
    {
      name: 'sofi-tunnel',
      script: path.join(__dirname, 'ngrok-runner.js'),
      cwd: __dirname,
      interpreter: 'C:\\Users\\vinicius.felix\\AppData\\Local\\nodejs\\node.exe',
      watch: false,
      autorestart: true,
      max_restarts: 50,
      min_uptime: '5s',
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(__dirname, 'logs', 'tunnel-error.log'),
      out_file: path.join(__dirname, 'logs', 'tunnel-out.log'),
      merge_logs: true,
    }
  ]
}
