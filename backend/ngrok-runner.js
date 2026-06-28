// Wrapper PM2 para o ngrok — mantém o túnel vivo com auto-restart
const { spawn } = require('child_process')
const path = require('path')

const ngrokExe = path.join(__dirname, 'ngrok.exe')

function start() {
  console.log('[ngrok] Iniciando túnel sofi...')
  const proc = spawn(ngrokExe, ['start', 'sofi'], {
    stdio: 'inherit',
    cwd: __dirname,
  })

  proc.on('exit', (code) => {
    console.log(`[ngrok] Processo encerrou com código ${code}. PM2 vai reiniciar.`)
    process.exit(code || 1)
  })

  proc.on('error', (err) => {
    console.error('[ngrok] Erro:', err.message)
    process.exit(1)
  })

  process.on('SIGINT', () => proc.kill('SIGINT'))
  process.on('SIGTERM', () => proc.kill('SIGTERM'))
}

start()
