/*
  # Admin Users Edge Function

  1. Purpose
    - Securely fetch all users with their profiles and roles
    - Uses service role key to access admin APIs
    - Provides centralized user data aggregation

  2. Security
    - Validates admin permissions before processing
    - Uses service role key securely on server-side
    - Returns sanitized user data

  3. Data Structure
    - Combines auth users, profiles, and user roles
    - Returns comprehensive user objects
    - Handles missing data gracefully
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface UserProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  phone: string
  bio: string
  created_at: string
  user_roles?: string[]
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create regular client to verify user permissions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify the user is authenticated and has admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user has admin role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        roles(name)
      `)
      .eq('user_id', user.id)

    if (roleError) {
      console.error('Error checking user roles:', roleError)
      return new Response(
        JSON.stringify({ error: 'Error verifying permissions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const hasAdminRole = userRoles?.some(ur => 
      ['admin', 'super_admin'].includes(ur.roles?.name)
    )

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Now fetch all users using admin client
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()

    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError)
      return new Response(
        JSON.stringify({ error: 'Error fetching users' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch profiles and user roles
    const [profilesResponse, userRolesResponse] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('user_roles').select(`
        user_id,
        roles(name)
      `)
    ])

    if (profilesResponse.error) {
      console.error('Error fetching profiles:', profilesResponse.error)
    }

    if (userRolesResponse.error) {
      console.error('Error fetching user roles:', userRolesResponse.error)
    }

    const profilesData = profilesResponse.data || []
    const userRolesData = userRolesResponse.data || []

    // Create maps for quick lookup
    const profilesMap = new Map(
      profilesData.map(profile => [profile.user_id, profile])
    )

    const userRolesMap = new Map()
    userRolesData.forEach(userRole => {
      if (!userRolesMap.has(userRole.user_id)) {
        userRolesMap.set(userRole.user_id, [])
      }
      if (userRole.roles?.name) {
        userRolesMap.get(userRole.user_id).push(userRole.roles.name)
      }
    })

    // Combine all user data
    const comprehensiveUsers: UserProfile[] = authUsers.users.map(authUser => {
      const profile = profilesMap.get(authUser.id)
      const userRoles = userRolesMap.get(authUser.id) || []

      return {
        id: authUser.id,
        user_id: authUser.id,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
        email: profile?.email || authUser.email || '',
        phone: profile?.phone || authUser.user_metadata?.phone || '',
        bio: profile?.bio || authUser.user_metadata?.bio || '',
        created_at: profile?.created_at || authUser.created_at,
        user_roles: userRoles.length > 0 ? userRoles : ['user']
      }
    })

    return new Response(
      JSON.stringify({ users: comprehensiveUsers }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})