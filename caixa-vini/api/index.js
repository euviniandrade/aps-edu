'use strict';
// Função da Vercel: entrega /api/*, /webhook/* e /saude ao servidor Fastify.
// O app em si (public/) é servido pela Vercel como arquivo estático.
const { criarApp } = require('../src/server');

let pronto = null;
function obterApp() {
  if (!pronto) {
    const app = criarApp();
    pronto = app.ready().then(() => app);
  }
  return pronto;
}

module.exports = async (req, res) => {
  const app = await obterApp();
  app.server.emit('request', req, res);
};
