import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabase';

interface UserRoleData {
  roles: {
    name: string
  } | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  userRoles: string[]
  isMantraCurator: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [isMantraCurator, setIsMantraCurator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchUserRoles = async (session: Session | null) => {
    if (!session?.user) {
      setUserRoles([])
      setIsMantraCurator(false)
      setIsAdmin(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', session.user.id) as { data: UserRoleData[] | null, error: any }

      if (error) throw error

      const roles = data?.map(item => item.roles?.name).filter((name): name is string => name != null) || []
      setUserRoles(roles)
      setIsMantraCurator(roles.includes('mantra_curator'))
      setIsAdmin(roles.includes('admin') || roles.includes('super_admin'))

    } catch (error) {
      console.error('Error fetching user roles:', error)
      setUserRoles([])
      setIsMantraCurator(false)
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      fetchUserRoles(session).finally(() => {
        if (mounted) setLoading(false)
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        fetchUserRoles(session).finally(() => {
          if (mounted) setLoading(false)
        })
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    loading,
    userRoles,
    isMantraCurator,
    isAdmin,
    signIn,
    signUp,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
