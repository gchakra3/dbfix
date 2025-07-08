import { Calendar, Clock, DollarSign, Filter, Plus, Save, Search, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/ui/Button'
import { LoadingSpinner } from '../../../shared/components/ui/LoadingSpinner'
import { supabase } from '../../../shared/lib/supabase'

interface ClassAssignment {
  id?: string
  scheduled_class_id: string
  instructor_id: string
  assigned_by: string
  payment_amount: number
  payment_status: 'pending' | 'paid' | 'cancelled'
  notes?: string
  assigned_at: string
  scheduled_class?: {
    id: string
    start_time: string
    end_time: string
    class_type: {
      name: string
      difficulty_level: string
    }
    instructor: {
      full_name: string
    }
  }
  instructor_profile?: {
    full_name: string
    email: string
    user_id: string
  }
}

interface UserProfile {
  user_id: string
  full_name: string
  email: string
  user_roles: {
    roles: {
      name: string
    }
  }[]
}

export function ClassAssignmentManager() {
  const [assignments, setAssignments] = useState<ClassAssignment[]>([])
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([])
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<any>({})
  
  // Filters
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    scheduled_class_id: '',
    instructor_id: '',
    role_type: 'instructor',
    payment_amount: 0,
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      console.log('🔍 Fetching instructor and yoga_acharya roles...')
      const { data: roles, error: roleError } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', ['instructor', 'yoga_acharya'])

      if (roleError) throw roleError
      
      console.log('📋 Found roles:', roles)
      
      if (!roles || roles.length === 0) {
        console.warn('⚠️ No instructor or yoga_acharya roles found')
        setAssignments([])
        setScheduledClasses([])
        setUserProfiles([])
        return
      }

      // Step 2: Get user IDs with instructor or yoga_acharya roles
      const roleIds = roles.map(role => role.id)
      console.log('🔑 Role IDs to search for:', roleIds)
      
      const { data: userRoleData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_id, roles(name)')
        .in('role_id', roleIds)

      if (userRolesError) throw userRolesError
      
      console.log('👥 Found user roles:', userRoleData)
      
      if (!userRoleData || userRoleData.length === 0) {
        console.warn('⚠️ No users found with instructor or yoga_acharya roles')
        setAssignments([])
        setScheduledClasses([])
        setUserProfiles([])
        return
      }

      // Fetch scheduled classes WITHOUT broken join
      console.log('📅 Fetching scheduled classes...')
      const { data: classesData, error: classesError } = await supabase
        .from('scheduled_classes')
        .select(`
          *,
          class_type:class_types(name, difficulty_level)
        `)
        .eq('status', 'scheduled')
        .order('start_time')

      if (classesError) throw classesError
      
      console.log('📊 Raw scheduled classes:', classesData)

      // Fetch profiles with user_roles
      console.log('👤 Fetching user profiles...')
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          email,
          phone,
          bio,
          user_roles(
            roles(name)
          )
        `)

      if (profilesError) throw profilesError
      
      console.log('📊 Raw profiles data:', profilesData)

      // Get unique user IDs from role data
      const instructorUserIds = [...new Set(userRoleData.map(ur => ur.user_id))]
      console.log('🆔 Instructor user IDs:', instructorUserIds)
      
      // Filter profiles to only those with instructor/yoga_acharya roles and valid data
      const filteredProfiles = (profilesData || [])
        .filter(profile => instructorUserIds.includes(profile.user_id))
        .filter(profile => {
          const hasValidName = profile.full_name?.trim()
          const hasValidEmail = profile.email?.trim()
          const isValid = profile.user_id && (hasValidName || hasValidEmail)
          
          if (!isValid) {
            console.warn('⚠️ Filtering out invalid profile:', profile)
          }
          
          return isValid
        })
        .map(profile => ({
          ...profile,
          // Ensure we have a display name
          full_name: profile.full_name?.trim() || 
                    profile.email?.split('@')[0]?.replace(/[._]/g, ' ') || 
                    'Unknown Instructor'
        }))
      
      console.log('✅ Filtered and enhanced profiles:', filteredProfiles)
      
      // Also filter by role in the user_roles array for extra validation
      const finalFilteredProfiles = filteredProfiles.filter(profile => {
        const userRoles = profile.user_roles?.map(ur => ur.roles?.name) || []
        const hasRequiredRole = userRoles.includes('instructor') || userRoles.includes('yoga_acharya')
        
        if (!hasRequiredRole) {
          console.warn('⚠️ Profile missing required role:', profile)
        }
        
        return hasRequiredRole
      })
      
      console.log('✅ Final filtered profiles:', finalFilteredProfiles)

      // Enrich scheduledClasses: attach instructor full_name manually
      const enrichedScheduledClasses = (classesData || []).map(scheduledClass => {
        const instructorProfile = finalFilteredProfiles?.find(profile => profile.user_id === scheduledClass.instructor_id)
        return {
          ...scheduledClass,
          instructor: {
            full_name: instructorProfile?.full_name || 'Unknown Instructor'
          }
        }
      })
      
      console.log('📅 Enriched scheduled classes:', enrichedScheduledClasses)

      // Fetch assignments
      console.log('📋 Fetching assignments...')
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('class_assignments')
        .select('*')
        .order('assigned_at', { ascending: false })

      if (assignmentsError) throw assignmentsError
      
      console.log('📊 Raw assignments data:', assignmentsData)

      // Merge assignments with related data
      const enrichedAssignments = (assignmentsData || []).map(assignment => {
        const scheduledClass = enrichedScheduledClasses?.find(cls => cls.id === assignment.scheduled_class_id)
        const instructorProfile = finalFilteredProfiles?.find(profile => profile.user_id === assignment.instructor_id)

        return {
          ...assignment,
          scheduled_class: scheduledClass,
          instructor_profile: instructorProfile
        }
      })
      
      console.log('📋 Enriched assignments:', enrichedAssignments)

      setAssignments(enrichedAssignments)
      setScheduledClasses(enrichedScheduledClasses)
      setUserProfiles(finalFilteredProfiles)
      
      console.log('✅ Data fetching completed successfully')
    } catch (error) {
      console.error('❌ Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: any = {}
    
    if (!formData.scheduled_class_id) newErrors.scheduled_class_id = 'Class is required'
    if (!formData.instructor_id) newErrors.instructor_id = 'Instructor/Acharya is required'
    if (formData.payment_amount <= 0) newErrors.payment_amount = 'Payment amount must be greater than 0'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setSaving(true)
      
      const currentUser = await supabase.auth.getUser()
      
      const assignmentData = {
        scheduled_class_id: formData.scheduled_class_id,
        instructor_id: formData.instructor_id,
        assigned_by: currentUser.data.user?.id,
        payment_amount: formData.payment_amount,
        payment_status: 'pending' as const,
        notes: formData.notes || null
      }

      const { error } = await supabase
        .from('class_assignments')
        .insert([assignmentData])

      if (error) throw error

      await fetchData()
      resetForm()
      alert('Class assigned successfully!')
    } catch (error: any) {
      setErrors({ general: error.message })
    } finally {
      setSaving(false)
    }
  }

  const updatePaymentStatus = async (assignmentId: string, status: 'pending' | 'paid' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('class_assignments')
        .update({ payment_status: status })
        .eq('id', assignmentId)

      if (error) throw error

      await fetchData()
      alert(`Payment status updated to ${status}`)
    } catch (error) {
      console.error('Error updating payment status:', error)
      alert('Failed to update payment status')
    }
  }

  const resetForm = () => {
    setFormData({
      scheduled_class_id: '',
      instructor_id: '',
      role_type: 'instructor',
      payment_amount: 0,
      notes: ''
    })
    setShowAssignForm(false)
    setErrors({})
  }

  const getFilteredUsers = () => {
    if (formData.role_type === 'all') return userProfiles
    
    return userProfiles.filter(profile => {
      const userRoles = profile.user_roles?.map(ur => ur.roles?.name) || []
      if (formData.role_type === 'instructor') {
        return userRoles.includes('instructor')
      }
      if (formData.role_type === 'yoga_acharya') {
        return userRoles.includes('yoga_acharya')
      }
      return true
    })
  }

  const getFilteredAssignments = () => {
    return assignments.filter(assignment => {
      const matchesRole = roleFilter === 'all' || 
        (assignment.instructor_profile && getUserRole(assignment.instructor_id) === roleFilter)
      
      const matchesStatus = statusFilter === 'all' || assignment.payment_status === statusFilter
      
      const matchesSearch = searchTerm === '' ||
        assignment.instructor_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.scheduled_class?.class_type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesRole && matchesStatus && matchesSearch
    })
  }

  const getUserRole = (userId: string) => {
    const profile = userProfiles.find(p => p.user_id === userId)
    const userRoles = profile?.user_roles?.map(ur => ur.roles?.name) || []
    
    if (userRoles.includes('yoga_acharya')) return 'yoga_acharya'
    if (userRoles.includes('instructor')) return 'instructor'
    return 'user'
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="w-6 h-6 mr-2" />
          Class Assignment Manager
        </h2>
        <Button
          onClick={() => setShowAssignForm(true)}
          className="flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Assign Class
        </Button>
      </div>

      {/* Assignment Form Modal */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Assign Class</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{errors.general}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Class *
                </label>
                <select
                  value={formData.scheduled_class_id}
                  onChange={(e) => handleInputChange('scheduled_class_id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.scheduled_class_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a class</option>
                  {scheduledClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_type.name} - {formatDateTime(cls.start_time)}
                    </option>
                  ))}
                </select>
                {errors.scheduled_class_id && <p className="text-red-500 text-sm mt-1">{errors.scheduled_class_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Type *
                </label>
                <select
                  value={formData.role_type}
                  onChange={(e) => {
                    handleInputChange('role_type', e.target.value)
                    handleInputChange('instructor_id', '') // Reset instructor selection
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="instructor">Instructor</option>
                  <option value="yoga_acharya">Yoga Acharya</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select {formData.role_type === 'instructor' ? 'Instructor' : 'Yoga Acharya'} *
                </label>
                <select
                  value={formData.instructor_id}
                  onChange={(e) => handleInputChange('instructor_id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.instructor_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select {formData.role_type === 'instructor' ? 'instructor' : 'yoga acharya'}</option>
                  {getFilteredUsers().map(profile => (
                    <option key={profile.user_id} value={profile.user_id}>
                      {profile.full_name || profile.email}
                    </option>
                  ))}
                </select>
                {errors.instructor_id && <p className="text-red-500 text-sm mt-1">{errors.instructor_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount ($) *
                </label>
                <input
                  type="number"
                  value={formData.payment_amount}
                  onChange={(e) => handleInputChange('payment_amount', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.payment_amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter payment amount"
                />
                {errors.payment_amount && <p className="text-red-500 text-sm mt-1">{errors.payment_amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes or instructions"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Assigning...' : 'Assign Class'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by instructor name or class..."
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
                <option value="instructor">Instructors</option>
                <option value="yoga_acharya">Yoga Acharyas</option>
              </select>
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {getFilteredAssignments().length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No assignments found</h3>
            <p className="text-gray-600">Start by assigning classes to instructors and yoga acharyas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredAssignments().map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.scheduled_class?.class_type?.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {assignment.scheduled_class && formatDateTime(assignment.scheduled_class.start_time)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Difficulty: {assignment.scheduled_class?.class_type?.difficulty_level}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.instructor_profile?.full_name || assignment.instructor_profile?.email}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {getUserRole(assignment.instructor_id).replace('_', ' ')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                        <span className="text-sm font-medium text-gray-900">
                          ${assignment.payment_amount}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(assignment.payment_status)}`}>
                        {assignment.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        {assignment.payment_status === 'pending' && (
                          <Button
                            onClick={() => updatePaymentStatus(assignment.id!, 'paid')}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Mark Paid
                          </Button>
                        )}
                        {assignment.payment_status !== 'cancelled' && (
                          <Button
                            onClick={() => updatePaymentStatus(assignment.id!, 'cancelled')}
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}