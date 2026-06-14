import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardList, FileText, GraduationCap, LayoutDashboard, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { authApi } from '@/services/auth'
import { setAccessToken } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

interface NavItem {
  to: string
  label: string
  icon: typeof BookOpen
  /** Roles allowed to see this link; omit for all authenticated users. */
  roles?: UserRole[]
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/teacher/exams', label: 'Exams', icon: GraduationCap, roles: ['teacher', 'admin'] },
  { to: '/teacher/questions', label: 'Question Bank', icon: BookOpen, roles: ['teacher', 'admin'] },
  { to: '/teacher/test-papers', label: 'Test Papers', icon: FileText, roles: ['teacher', 'admin'] },
  { to: '/attempts', label: 'My Attempts', icon: ClipboardList },
]

interface TeacherPageShellProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export function TeacherPageShell({ title, description, action, children }: TeacherPageShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      logout()
      navigate('/login')
    }
  }

  const navItems = NAV.filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false))

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              Q
            </span>
            <span className="hidden sm:inline">QuizzerApp</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground lg:inline">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page header + content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}
