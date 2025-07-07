import { Edit, Filter, Search, Shield, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/ui/Button'
import { LoadingSpinner } from '../../../shared/components/ui/LoadingSpinner'
import { supabase } from '../../../shared/lib/supabase'
import { useUserProfiles } from '../../user-profile/hooks/useUserProfiles'
import { UserRoleManagement } from './UserRoleManagement'

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

export function UserManagement() {
  const { profiles, loading: profilesLoading, refetch } = useUserProfiles()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [showRoleManagement, setShowRoleManagement] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Call the secure Edge Function instead of direct admin API
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error in fetchUsers:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleRoleUpdate = async (userId: string, newRoles: string[]) => {
    // Update the local state
    setUsers(prev => prev.map(user => 
      user.user_id === userId 
        ? { ...user, user_roles: newRoles }
        : user
    ))
    
    // Refresh the data
    await fetchUsers()
    setShowRoleManagement(false)
    setSelectedUser(null)
  }

  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch = searchTerm === '' ||
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRole = roleFilter === 'all' || 
        (user.user_roles && user.user_roles.includes(roleFilter))
      
      return matchesSearch && matchesRole
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-red-100 text-red-800'
      case 'instructor':
        return 'bg-blue-100 text-blue-800'
      case 'yoga_acharya':
        return 'bg-purple-100 text-purple-800'
      case 'mantra_curator':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading || profilesLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="text-red-600 font-semibold mb-2">Error Loading Users</div>
        <div className="text-red-500 text-sm mb-4">{error}</div>
        <Button 
          onClick={fetchUsers}
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (showRoleManagement && selectedUser) {
    return (
      <UserRoleManagement
        userId={selectedUser.user_id}
        userEmail={selectedUser.email}
        currentRoles={selectedUser.user_roles || []}
        onRoleUpdate={(newRoles) => handleRoleUpdate(selectedUser.user_id, newRoles)}
        onClose={() => {
          setShowRoleManagement(false)
          setSelectedUser(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="w-6 h-6 mr-2" />
          User Management ({users.length})
        </h2>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="instructor">Instructors</option>
                <option value="yoga_acharya">Yoga Acharyas</option>
                <option value="mantra_curator">Mantra Curators</option>
                <option value="admin">Admins</option>
                <option value="super_admin">Super Admins</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {getFilteredUsers().length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredUsers().map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'No name'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-gray-400">{user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles && user.user_roles.length > 0 ? (
                          user.user_roles.map((role, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 text-xs rounded-full ${getRoleColor(role)}`}
                            >
                              {role.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            user
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowRoleManagement(true)
                        }}
                        size="sm"
                        variant="outline"
                        className="flex items-center"
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Manage Roles
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {users.length}
          </div>
          <div className="text-gray-600">Total Users</div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {users.filter(u => u.user_roles?.includes('instructor')).length}
          </div>
          <div className="text-gray-600">Instructors</div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {users.filter(u => u.user_roles?.includes('yoga_acharya')).length}
          </div>
          <div className="text-gray-600">Yoga Acharyas</div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl font-bold text-red-600 mb-2">
            {users.filter(u => u.user_roles?.some(role => ['admin', 'super_admin'].includes(role))).length}
          </div>
          <div className="text-gray-600">Admins</div>
        </div>
      </div>
    </div>
  )
}