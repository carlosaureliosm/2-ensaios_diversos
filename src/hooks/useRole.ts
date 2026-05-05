// src/hooks/useRole.ts
// Hook para controle de acesso baseado em perfis (RBAC).
// Perfis: 'tecnico' | 'coordenador' | 'admin'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'tecnico' | 'coordenador' | 'admin'

interface UseRoleReturn {
  role: UserRole | null
  isAdmin: boolean
  isCoordenador: boolean
  loading: boolean
}

export function useRole(): UseRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      // O perfil é armazenado na tabela `profiles` com coluna `role`
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setRole((data?.role as UserRole) ?? 'tecnico')
      setLoading(false)
    }

    fetchRole()
  }, [])

  return {
    role,
    isAdmin: role === 'admin',
    isCoordenador: role === 'coordenador' || role === 'admin',
    loading,
  }
}
