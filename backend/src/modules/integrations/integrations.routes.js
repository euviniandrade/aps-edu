const { buildStatus, fetchGoogleProfile, fetchMicrosoftProfile, storeIcloudIntegration, storeOAuthIntegration } = require('./integrations.service')
const { authenticate } = require('../../shared/middleware/auth.middleware')

module.exports = async function (fastify) {
  fastify.get('/status', { preHandler: [authenticate] }, async (request) => {
    return buildStatus(request.currentUser.id)
  })

  fastify.post('/oauth/store', { preHandler: [authenticate] }, async (request, reply) => {
    const { provider, tokenData } = request.body || {}
    if (!provider || !tokenData?.access_token) {
      return reply.code(400).send({ error: 'provider e tokenData são obrigatórios' })
    }

    let profile = {}
    if (provider === 'google') profile = await fetchGoogleProfile(tokenData.access_token)
    if (provider === 'microsoft') profile = await fetchMicrosoftProfile(tokenData.access_token)

    const integration = await storeOAuthIntegration({
      userId: request.currentUser.id,
      provider,
      tokenData,
      email: profile.email || profile.userPrincipalName,
      externalAccountId: profile.id,
      meta: profile,
    })

    return reply.code(201).send({ ok: true, integration })
  })

  fastify.post('/icloud/configure', { preHandler: [authenticate] }, async (request, reply) => {
    const { appleId, appPassword, calendarUrl, contactsUrl } = request.body || {}
    if (!appleId || !appPassword) {
      return reply.code(400).send({ error: 'appleId e appPassword são obrigatórios' })
    }
    const integration = await storeIcloudIntegration({
      userId: request.currentUser.id,
      appleId,
      appPassword,
      calendarUrl,
      contactsUrl,
    })
    return reply.code(201).send({ ok: true, integration })
  })

}
