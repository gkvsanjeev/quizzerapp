import { api } from './api'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  MessageOut,
  RegisterPayload,
  ResetPasswordPayload,
  TokenOut,
  User,
} from '@/types/auth'

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<TokenOut>('/api/auth/register', data).then((r) => r.data),

  login: (data: LoginPayload) =>
    api.post<TokenOut>('/api/auth/login', data).then((r) => r.data),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get<User>('/api/auth/me').then((r) => r.data),

  forgotPassword: (data: ForgotPasswordPayload) =>
    api.post<MessageOut>('/api/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetPasswordPayload) =>
    api.post<MessageOut>('/api/auth/reset-password', data).then((r) => r.data),
}
