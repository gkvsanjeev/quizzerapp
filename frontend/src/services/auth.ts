import { api } from './api'
import type { LoginPayload, RegisterPayload, TokenOut, User } from '@/types/auth'

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<TokenOut>('/api/auth/register', data).then((r) => r.data),

  login: (data: LoginPayload) =>
    api.post<TokenOut>('/api/auth/login', data).then((r) => r.data),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get<User>('/api/auth/me').then((r) => r.data),
}
