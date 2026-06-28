/**
 * Configuração PM2 para o backend APS-EDU na Oracle VM (498MB RAM)
 * Deploy: scp este arquivo para /opt/aps-edu/backend/ e rode: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'aps-backend',
      script: 'src/server.js',
      cwd: '/opt/aps-edu/backend',

      // Memória — limite rígido para evitar OOM no servidor de 498MB
      node_args: '--max-old-space-size=220',
      max_memory_restart: '260M',

      // Reinício automático
      restart_delay: 10000,   // aguarda 10s antes de reiniciar
      max_restarts: 10,
      min_uptime: '15s',

      // Logs
      out_file: '/home/opc/.pm2/logs/aps-backend-out.log',
      error_file: '/home/opc/.pm2/logs/aps-backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Ambiente de produção
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
