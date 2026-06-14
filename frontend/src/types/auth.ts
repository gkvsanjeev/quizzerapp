export type UserRole = 'student' | 'teacher' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: User
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
  role?: UserRole
}

export interface LoginPayload {
  email: string
  password: string
}
