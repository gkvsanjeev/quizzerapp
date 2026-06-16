import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Dashboard from '@/pages/dashboard/Dashboard'
import ExamsPage from '@/pages/teacher/ExamsPage'
import QuestionBankPage from '@/pages/teacher/QuestionBankPage'
import TestPaperPage from '@/pages/teacher/TestPaperPage'
import RAGPage from '@/pages/teacher/RAGPage'
import ExamPage from '@/pages/exam/ExamPage'
import AttemptsPage from '@/pages/student/AttemptsPage'
import AnalysisPage from '@/pages/analysis/AnalysisPage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/authStore'

const queryClient = new QueryClient()

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/teacher/exams"
              element={
                <PrivateRoute>
                  <ExamsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/teacher/questions"
              element={
                <PrivateRoute>
                  <QuestionBankPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/teacher/test-papers"
              element={
                <PrivateRoute>
                  <TestPaperPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/teacher/rag"
              element={
                <PrivateRoute>
                  <RAGPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/attempts"
              element={
                <PrivateRoute>
                  <AttemptsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/exam/:attemptId"
              element={
                <PrivateRoute>
                  <ExamPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/analysis/:attemptId"
              element={
                <PrivateRoute>
                  <AnalysisPage />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
