# ✅ CHECKLIST DE PRODUÇÃO

**Validação final antes do deploy**

---

## 🔒 SEGURANÇA

- [ ] Todas as chaves de API em `.env`, não no código
- [ ] CORS configurado corretamente (não `*` em produção)
- [ ] Senhas do BD usando variáveis de ambiente
- [ ] TLS/HTTPS habilitado
- [ ] Rate limiting configurado
- [ ] Validação de entrada em todas as rotas
- [ ] Sanitização de output ativada
- [ ] Headers de segurança (Content-Security-Policy, etc)
- [ ] Logs não contêm dados sensíveis
- [ ] Credenciais do Telegram secure

## 🗄️ BANCO DE DADOS

- [ ] Migrations executadas (`npx prisma migrate deploy`)
- [ ] Índices criados e verificados
- [ ] Backup automático configurado
- [ ] Connection pooling ativado (recomendado: 20)
- [ ] Timezone do BD = UTC
- [ ] Backups diários agendados
- [ ] Plano de recuperação de desastre documentado
- [ ] Database URL usa SSL/TLS

## ⚡ CACHE & JOBS

- [ ] Redis configurado e testado
- [ ] Redis persistência (RDB ou AOF) ativada
- [ ] Redis AUTH configurado
- [ ] BullMQ workers testados
- [ ] Job concurrency adequada (recomendado: 5-10)
- [ ] Redis maxmemory policy = `allkeys-lru`
- [ ] Monitoramento Redis ativado

## 📱 WHATSAPP

- [ ] Baileys com exponential backoff verificado
- [ ] Circuit breaker testado
- [ ] Rate limiting 40 msgs/min confirmado
- [ ] QR code auto-refresh funcionando
- [ ] Health check ativo (30s interval)
- [ ] Graceful shutdown testado
- [ ] Reconnection timeout apropriado (120s)

## 🤖 AI SERVICES

- [ ] API key OpenAI/Claude configurada
- [ ] Guardrails funcionando (validação input/output)
- [ ] Fallback responses testadas
- [ ] Circuit breaker IA funcionando
- [ ] Rate limiting IA (30/hora) configurado
- [ ] Knowledge base populada com artigos
- [ ] Contexto de conversa sendo salvo
- [ ] Cleanup de conversas antigas agendado

## 📊 MONITORING & ALERTS

- [ ] Telegram BOT_TOKEN e CHAT_ID configurados
- [ ] Health endpoint respondendo
- [ ] Dashboard acessível e mostrando métricas
- [ ] Event log funcionando
- [ ] Alertas testados (send test alert)
- [ ] Thresholds apropriados (CPU, memória, erro rate)
- [ ] APM configurado (New Relic, DataDog, etc)

## 🌍 DEPLOYMENT

- [ ] Node.js versão LTS (v18+)
- [ ] npm dependencies atualizadas (`npm audit fix`)
- [ ] PM2 ou similar para process management
- [ ] Logs centralizados (ELK, Datadog, etc)
- [ ] Environment variables carregadas corretamente
- [ ] Porta 3000 acessível ou proxy reverso configurado
- [ ] Reverse proxy (nginx) configurado se necessário
- [ ] Certificado SSL válido

## 📋 TESTES

- [ ] WhatsApp: enviar e receber mensagens
- [ ] Cache: hit/miss funcionando
- [ ] Jobs: envio de mensagens na fila
- [ ] AI: resposta com contexto funcionando
- [ ] Fallback: AI desponível, usar fallback
- [ ] Polling: SSE + fallback testado
- [ ] Alertas: Telegram recebendo notificações
- [ ] Health: `/health` retorna 200 OK

## 📈 PERFORMANCE

- [ ] Response time < 500ms (P95)
- [ ] Cache hit rate > 75%
- [ ] AI success rate > 90%
- [ ] Database queries otimizadas
- [ ] Memory leak check (24h rodando)
- [ ] Load test (500+ msgs/min)

## 📚 DOCUMENTAÇÃO

- [ ] README.md atualizado
- [ ] API documentation pronto
- [ ] Setup guide para novos devs
- [ ] Runbook para operações
- [ ] Procedure de escalabilidade
- [ ] Disaster recovery plan

## 🚨 MONITORAMENTO

- [ ] Alertas configurados para:
  - [ ] WhatsApp desconexão
  - [ ] Falha de IA API
  - [ ] Falha de BD
  - [ ] CPU > 80%
  - [ ] Memória > 85%
  - [ ] Error rate > 5%
  - [ ] Queue overflow

- [ ] Dashboards criados:
  - [ ] Mensagens/min
  - [ ] Taxa de sucesso
  - [ ] Latência
  - [ ] Cache hit rate
  - [ ] Saúde dos workers

## 🔄 BACKUP & RECOVERY

- [ ] Backup automático a cada 6 horas
- [ ] Retenção de 30 dias
- [ ] Teste de restauração realizado
- [ ] Off-site backup ativado
- [ ] Database encryption em repouso

## 🎯 BEFORE LAUNCH (Final)

```bash
# 1. Run all tests
npm test

# 2. Check security
npm audit

# 3. Lint code
npm run lint

# 4. Build for production
npm run build

# 5. Start server
npm start

# 6. Verify endpoints
curl http://localhost:3000/health
curl http://localhost:3000/dashboard

# 7. Monitor logs for 1 hour
tail -f logs/server.log

# 8. Test Telegram alerts
curl -X POST http://localhost:3000/alerts/test

# 9. Load test (optional)
# Use: ab, wrk, k6, etc
# Target: 500+ msgs/min
```

## 📞 ROLLBACK PLAN

Se algo der errado em produção:

1. **Imediato**: Parar serviço (AWS, Heroku, etc)
2. **BD**: Restaurar backup da última hora
3. **Código**: Fazer rollback para git commit anterior
4. **Alertas**: Notificar times via Telegram
5. **Post-mortem**: Revisar logs e correções

---

## 🟢 PRONTO PARA PRODUÇÃO?

Responda SIM para todas as perguntas abaixo:

- [ ] Todas as dependências atualizadas
- [ ] Testes passando 100%
- [ ] Nenhum security issue pendente
- [ ] Performance benchmarks atingidos
- [ ] Logs estruturados e centralizados
- [ ] Backups testados e automatizados
- [ ] Alertas configurados e testados
- [ ] Time preparado para operação
- [ ] Runbook documentado
- [ ] Plano de escalabilidade pronto

---

**Se respondeu SIM para tudo, você está pronto! 🚀**

