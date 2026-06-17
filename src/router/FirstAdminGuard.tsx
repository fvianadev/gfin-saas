import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function FirstAdminGuard() {
  const [status, setStatus] = useState<'checking' | 'first' | 'exists'>('checking')

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.rpc('is_first_saas_admin')
      if (error) {
        console.error('FirstAdminGuard RPC error:', (error as any)?.code, (error as any)?.message, (error as any)?.details, (error as any)?.hint)
        setStatus('exists')
        return
      }
      const isFirst = data === true || (typeof data === 'object' && data !== null && (data as any).is_first_saas_admin === true)
      setStatus(isFirst ? 'first' : 'exists')
    })()
  }, [])

  if (status === 'checking') {
    return <div className="min-h-screen bg-slate-950" />
  }

  if (status === 'exists') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
