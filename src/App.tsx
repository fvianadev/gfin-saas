import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LandingPage } from './components/LandingPage'
import { LoginPage } from './components/auth/LoginPage'
import type { UserSession } from './types/auth'

const RegisterPage = lazy(() => import('./components/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ResetPasswordPage = lazy(() => import('./components/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const StaffLogin = lazy(() => import('./components/StaffLogin').then(m => ({ default: m.StaffLogin })))
const StaffDashboard = lazy(() => import('./components/StaffDashboard').then(m => ({ default: m.StaffDashboard })))
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })))
const PublicBooking = lazy(() => import('./components/PublicBooking').then(m => ({ default: m.PublicBooking })))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const FirstAdminGuard = lazy(() => import('./router/FirstAdminGuard').then(m => ({ default: m.FirstAdminGuard })))
const FirstAdminSetup = lazy(() => import('./pages/setup/FirstAdminSetup').then(m => ({ default: m.FirstAdminSetup })))

export default function App() {
  const [admin, setAdmin] = useState<UserSession | null>(() => {
    const stored = sessionStorage.getItem('gfin_admin')
    return stored ? JSON.parse(stored) : null
  })

  const handleLoginState = (session: UserSession) => {
    sessionStorage.setItem('gfin_admin', JSON.stringify(session))
    setAdmin(session)
  }

  const logoutAdmin = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('gfin_admin')
    setAdmin(null)
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-2 border-emerald-500 border-t-transparent" /></div>}>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onLogin={handleLoginState} />} />
      <Route path="/register" element={<RegisterPage onLogin={handleLoginState} />} />
       <Route path="/register-saas-admin" element={<Navigate to="/setup" replace />} />
       <Route path="/novo-admin" element={<Navigate to="/setup" replace />} />
       <Route element={<FirstAdminGuard />}>
         <Route path="/setup" element={<FirstAdminSetup onLogin={handleLoginState} />} />
       </Route>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/create-account" element={<Navigate to="/register" replace />} />
      <Route path="/admin" element={admin && admin.role !== 'super_admin' ? <ErrorBoundary><AdminDashboard onBack={logoutAdmin} estabelecimentoId={admin.estabelecimento_id} membroId={admin.membro_id || ''} cargo={admin.role} isOwner={true} /></ErrorBoundary> : <Navigate to="/login" />} />
      <Route path="/super-admin" element={admin?.role === 'super_admin' ? <ErrorBoundary><SuperAdminDashboard onLogout={logoutAdmin} /></ErrorBoundary> : <Navigate to="/login" />} />
      <Route path="/:slug" element={<Navigate to="login" replace />} />
      <Route path="/:slug/login" element={<StaffLogin />} />
      <Route path="/:slug/dashboard" element={<StaffDashboard />} />
      <Route path="/:slug/agendar" element={<PublicBooking />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
