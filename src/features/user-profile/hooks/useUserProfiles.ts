import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'

interface UserProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  bio: string
  experience_level: string
  created_at: string
  updated_at: string
  email: string
  user_created_at: string  
  user_roles?: string[]
  total_bookings?: number
  attended_classes?: number
  articles_viewed?: number
}

export function useUserProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfiles = async () => {
    try {
      setLoading(true)
      setError(null)

      // First try to use the RPC function if it exists
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_profiles_for_admin')

      if (!rpcError && rpcData) {
        setProfiles(rpcData)
        return
      }

      // Fallback: fetch profiles and user roles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Fetch user roles separately
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles(name)
        `)

      if (userRolesError) throw userRolesError

      // Transform the data to match the expected format
      const transformedData = (profilesData || []).map(profile => {
        // Find roles for this user
        const userRoleEntries = (userRolesData || []).filter(ur => ur.user_id === profile.user_id)
        const userRoles = userRoleEntries.map(ur => ur.roles?.name).filter(Boolean)
        
        // If no roles found, default to 'user'
        if (userRoles.length === 0) {
          userRoles.push('user')
        }
        
        return {
          ...profile,
          user_id: profile.user_id || profile.id,
          experience_level: profile.role || 'user',
          user_created_at: profile.created_at,
          total_bookings: 0,
          attended_classes: 0,
          articles_viewed: 0,
          user_roles: userRoles
        }
      })

      setProfiles(transformedData)
    } catch (err: any) {
      console.error('Error fetching user profiles:', err)
      setError(err.message || 'Failed to load user profiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  return {
    profiles,
    loading,
    error,
    refetch: fetchProfiles
  }
}