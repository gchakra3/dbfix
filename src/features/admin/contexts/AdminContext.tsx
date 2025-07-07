import { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabase';

interface UserRoleData {
  roles: {
    name: string
  } | null
}

interface AdminContextType {
  admin: User | null
  loading: boolean
  isAdmin: boolean
  isMantraCurator: boolean
  signInAdmin: (email: string, password: string) => Promise<void>
  signOutAdmin: () => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMantraCurator, setIsMantraCurator] = useState(false)

  const checkUserRoles = async (user: User | null) => {
    if (!user) {
      setIsAdmin(false)
      setIsMantraCurator(false)
      return
    }

    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id) as { data: UserRoleData[] | null, error: any }

      if (roleError) throw roleError

      const userRoles = roleData?.map(item => item.roles?.name).filter(Boolean) || []

      setIsAdmin(userRoles.includes('admin') || userRoles.includes('super_admin'))
      setIsMantraCurator(userRoles.includes('mantra_curator'))
    } catch (error) {
      console.error('Exception during role check:', error)
      setIsAdmin(false)
      setIsMantraCurator(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return

      const user = session?.user ?? null
      setAdmin(user)
      checkUserRoles(user).finally(() => {
        if (mounted) setLoading(false)
      })
    }).catch(error => {
      console.error('Error getting initial session:', error)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return

        const user = session?.user ?? null
        setAdmin(user)
        checkUserRoles(user).finally(() => {
          if (mounted) setLoading(false)
        })
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []);

  const signInAdmin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Admin sign in error:', error)
      throw error
    }
  }

  const signOutAdmin = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    admin,
    loading,
    signInAdmin,
    signOutAdmin,
    isAdmin,
    isMantraCurator,
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
