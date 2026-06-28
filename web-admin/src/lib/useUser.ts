'use client'
import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: string     // 'admin' | 'leader' | 'member'
  unitId?: string
  unitName?: string
  avatar?: string
}

export function useUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)
  useEffect(() => {
    try {
      const raw = Cookies.get('user')
      if (raw) setUser(JSON.parse(decodeURIComponent(raw)))
    } catch {}
  }, [])
  return user
}

export function useIsAdmin(): boolean {
  const user = useUser()
  return user?.role === 'admin' || user?.role === 'super_admin'
}

export function useIsLeader(): boolean {
  const user = useUser()
  return user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'leader' || user?.role === 'coordinator'
}

export function useCanEdit(): boolean {
  return useIsLeader()
}
