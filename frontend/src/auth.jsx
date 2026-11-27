import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from './api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  useEffect(() => {
    if (!getToken()) return
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false))
    const h = () => setUser(null)
    window.addEventListener('talentiq-logout', h)
    return () => window.removeEventListener('talentiq-logout', h)
  }, [])

  const accept = (res) => { setToken(res.token); setUser(res.user); return res.user }
  const value = {
    user, loading, logout, setUser,
    login: async (b) => accept(await api.login(b)),
    register: async (b) => accept(await api.register(b)),
    demo: async (role) => accept(await api.demoLogin(role)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
