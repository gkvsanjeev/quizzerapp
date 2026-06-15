import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, FileText, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/services/auth'
import { setAccessToken } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const TEACHER_LINKS = [
  {
    to: '/teacher/exams',
    label: 'Exams',
    description: 'Create exam series and subjects',
    icon: GraduationCap,
  },
  {
    to: '/teacher/questions',
    label: 'Question Bank',
    description: 'Add and organise questions',
    icon: BookOpen,
  },
  {
    to: '/teacher/test-papers',
    label: 'Test Papers',
    description: 'Assemble timed mock tests',
    icon: FileText,
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      logout()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Welcome back, <span className="font-medium text-gray-700">{user?.name}</span>
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">Role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold capitalize">{user?.role}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium truncate">{user?.email}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center gap-2 text-green-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Active
              </span>
            </CardContent>
          </Card>
        </div>

        {user?.role === 'student' && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">My exams</h2>
          <Link to="/attempts" className="group block max-w-sm">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-base font-semibold group-hover:text-primary">
                    My Attempts
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View your exam history, scores, and analysis
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        )}

        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Teacher console</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TEACHER_LINKS.map(({ to, label, description, icon: Icon }) => (
                <Link key={to} to={to} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <CardTitle className="text-base font-semibold group-hover:text-primary">
                          {label}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
