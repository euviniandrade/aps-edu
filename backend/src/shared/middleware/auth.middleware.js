const prisma = require('../config/prisma')

async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: { role: true, unit: true }
    })
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Usuário não autorizado' })
    }
    request.currentUser = user
  } catch (err) {
    reply.code(401).send({ error: 'Token inválido ou expirado' })
  }
}

function authorize(...slugs) {
  return async function (request, reply) {
    if (!slugs.includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Acesso negado para esta função' })
    }
  }
}

function authorizeAdmin(request, reply, done) {
  const adminSlugs = ['admin', 'director']
  if (!adminSlugs.includes(request.currentUser.role.slug)) {
    return reply.code(403).send({ error: 'Apenas administradores podem realizar esta ação' })
  }
  done()
}

module.exports = { authenticate, authorize, authorizeAdmin }
