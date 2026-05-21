import axios from 'axios'
import Cookies from 'js-cookie'

// Todas as chamadas vão para o proxy Next.js em /api/*
// que repassa para o Google Apps Script
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = Cookies.get('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken })
          Cookies.set('accessToken', data.accessToken, { expires: 30 })
          error.config.headers.Authorization = `Bearer ${data.accessToken}`
          return axios(error.config)
        } catch {
          Cookies.remove('accessToken')
          Cookies.remove('refreshToken')
          Cookies.remove('user')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
