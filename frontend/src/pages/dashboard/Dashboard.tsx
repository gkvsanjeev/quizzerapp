import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/services/auth'
import { setAccessToken } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

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

        <Card className="mt-8">
          <CardContent className="p-12 text-center text-muted-foreground">
            <p className="text-lg">Exams and test papers will appear here once configured.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
