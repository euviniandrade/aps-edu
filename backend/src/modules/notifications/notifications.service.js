const prisma = require('../../shared/config/prisma')

async function send({ userId, type, title, body, data = {}, fcmToken }) {
  // Salvar notificação no banco
  await prisma.notification.create({
    data: { userId, type, title, body, data, isRead: false }
  })

  // Enviar push via Firebase Cloud Messaging
  if (fcmToken) {
    await sendPush(fcmToken, title, body, data)
  }
}

async function sendPush(token, title, body, data = {}) {
  try {
    // Firebase Admin SDK
    if (!process.env.FIREBASE_PROJECT_ID) return

    const admin = require('firebase-admin')

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      })
    }

    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'aps_edu' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } }
    })
  } catch (err) {
    console.error('Erro ao enviar push:', err.message)
  }
}

async function markRead(notificationId, userId) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  })
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  })
}

module.exports = { send, markRead, markAllRead }
