import { Award, Edit, GraduationCap, Plus, Save, Trash2, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/ui/Button'
import { LoadingSpinner } from '../../../shared/components/ui/LoadingSpinner'
import { supabase } from '../../../shared/lib/supabase'

interface Instructor {
  id?: string
  user_id?: string
  full_name: string
  bio: string
  email: string
  phone: string
  specialties: string[]
  experience_years: number
  certification: string
  avatar_url: string
  is_active: boolean
}

export function InstructorManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null)
  const [errors, setErrors] = useState<any>({})

  const [formData, setFormData] = useState<Instructor>({
    full_name: '',
    bio: '',
    email: '',
    phone: '',
    specialties: [],
    experience_years: 0,
    certification: '',
    avatar_url: '',
    is_active: true
  })

  const [newSpecialty, setNewSpecialty] = useState('')

  const commonSpecialties = [
    'Hatha Yoga', 'Vinyasa Flow', 'Power Yoga', 'Restorative Yoga',
    'Yin Yoga', 'Ashtanga', 'Bikram', 'Hot Yoga', 'Prenatal Yoga',
    'Meditation', 'Breathwork', 'Yoga Therapy', 'Corporate Wellness'
  ]

  useEffect(() => {
    fetchInstructors()
  }, [])

  const fetchInstructors = async () => {
    try {
      setLoading(true)
      
      console.log('🔍 Fetching instructor and yoga_acharya roles...')
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', ['instructor', 'yoga_acharya'])

      if (roleError) throw roleError
      
      console.log('📋 Found roles:', roleData)

      if (!roleData || roleData.length === 0) {
        console.warn('⚠️ No instructor or yoga_acharya roles found')
        setInstructors([])
        return
      }

      // Extract role IDs
      const roleIds = roleData.map(role => role.id)
      console.log('🔑 Role IDs to search for:', roleIds)

      // Then, get all user IDs that have either instructor or yoga_acharya role
      const { data: userRoleData, error: userRoleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', roleIds)

      if (userRoleError) throw userRoleError
      
      console.log('👥 Found user roles:', userRoleData)

      if (!userRoleData || userRoleData.length === 0) {
        console.warn('⚠️ No users found with instructor or yoga_acharya roles')
        setInstructors([])
        return
      }

      // Extract unique user IDs (in case a user has both roles)
      const instructorUserIds = [...new Set(userRoleData.map(ur => ur.user_id))]
      console.log('🆔 Unique instructor user IDs:', instructorUserIds)

      // Finally, fetch profiles for these users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, bio, specialties, experience_years, certification, avatar_url, is_active')
        .in('user_id', instructorUserIds)
        .order('full_name')

      if (profileError) throw profileError
      
      console.log('📊 Raw instructor profiles:', profileData)
      
      // Filter out profiles without proper names or emails
      const validProfiles = (profileData || []).filter(profile => {
        const hasValidName = profile.full_name?.trim()
        const hasValidEmail = profile.email?.trim()
        const isValid = profile.user_id && (hasValidName || hasValidEmail)
        
        if (!isValid) {
          console.warn('⚠️ Filtering out invalid instructor profile:', profile)
        }
        
        return isValid
      })
      
      console.log('✅ Valid instructor profiles after filtering:', validProfiles)
      
      // Map the data to the Instructor interface
      const instructorData = validProfiles.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name?.trim() || profile.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Unknown Instructor',
        email: profile.email?.trim() || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        specialties: profile.specialties || [],
        experience_years: profile.experience_years || 0,
        certification: profile.certification || '',
        avatar_url: profile.avatar_url || '',
        is_active: profile.is_active ?? true
      }))
      
      console.log('📋 Final instructor data:', instructorData)

      setInstructors(instructorData)
      console.log('✅ Instructor fetching completed successfully')
    } catch (error) {
      console.error('❌ Error fetching instructors:', error)
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

  const handleAddSpecialty = () => {
    if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty.trim())) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty.trim()]
      }))
      setNewSpecialty('')
    }
  }

  const handleRemoveSpecialty = (specialtyToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.filter(specialty => specialty !== specialtyToRemove)
    }))
  }

  const validateForm = () => {
    const newErrors: any = {}

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format'
    if (!formData.bio.trim()) newErrors.bio = 'Bio is required'
    if (formData.experience_years < 0) newErrors.experience_years = 'Experience years cannot be negative'
    if (formData.specialties.length === 0) newErrors.specialties = 'At least one specialty is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setSaving(true)

      if (editingInstructor) {
        // Update existing instructor profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            bio: formData.bio,
            specialties: formData.specialties,
            experience_years: formData.experience_years,
            certification: formData.certification,
            avatar_url: formData.avatar_url,
            is_active: formData.is_active
          })
          .eq('id', editingInstructor.id)

        if (error) throw error
      } else {
        // Create new instructor: need to create user, profile, and assign role
        
        // First, create a new user account
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          email_confirm: true,
          user_metadata: {
            full_name: formData.full_name
          }
        })

        if (authError) throw authError

        if (!authData.user) throw new Error('Failed to create user')

        // Create profile for the new user
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert([{
            user_id: authData.user.id,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            bio: formData.bio,
            specialties: formData.specialties,
            experience_years: formData.experience_years,
            certification: formData.certification,
            avatar_url: formData.avatar_url,
            is_active: formData.is_active
          }])
          .select()
          .single()

        if (profileError) throw profileError

        // Get the instructor role ID
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'instructor')
          .single()

        if (roleError) throw roleError

        // Assign instructor role to the user
        const { error: userRoleError } = await supabase
          .from('user_roles')
          .insert([{
            user_id: authData.user.id,
            role_id: roleData.id
          }])

        if (userRoleError) throw userRoleError
      }

      await fetchInstructors()
      resetForm()
      alert(editingInstructor ? 'Instructor updated successfully!' : 'Instructor created successfully!')
    } catch (error: any) {
      console.error('Error saving instructor:', error)
      setErrors({ general: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor)
    setFormData({ ...instructor })
    setShowForm(true)
  }

  const handleDelete = async (instructor: Instructor) => {
    if (!confirm('Are you sure you want to remove instructor role from this user?')) return

    try {
      // Get the instructor role ID
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'instructor')
        .single()

      if (roleError) throw roleError

      // Remove the instructor role from the user
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', instructor.user_id)
        .eq('role_id', roleData.id)

      if (error) throw error

      await fetchInstructors()
      alert('Instructor role removed successfully!')
    } catch (error) {
      console.error('Error removing instructor role:', error)
      alert('Failed to remove instructor role')
    }
  }

  const resetForm = () => {
    setFormData({
      full_name: '',
      bio: '',
      email: '',
      phone: '',
      specialties: [],
      experience_years: 0,
      certification: '',
      avatar_url: '',
      is_active: true
    })
    setEditingInstructor(null)
    setShowForm(false)
    setErrors({})
    setNewSpecialty('')
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
          <GraduationCap className="w-6 h-6 mr-2" />
          Instructor Management
        </h2>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Instructor
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingInstructor ? 'Edit Instructor' : 'Add New Instructor'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.full_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter instructor's full name"
                  />
                  {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="instructor@example.com"
                    disabled={!!editingInstructor} // Disable email editing for existing instructors
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => handleInputChange('experience_years', parseInt(e.target.value) || 0)}
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.experience_years ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.experience_years && <p className="text-red-500 text-sm mt-1">{errors.experience_years}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio *
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.bio ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Tell us about the instructor's background, teaching style, and philosophy"
                />
                {errors.bio && <p className="text-red-500 text-sm mt-1">{errors.bio}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certification
                </label>
                <input
                  type="text"
                  value={formData.certification}
                  onChange={(e) => handleInputChange('certification', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., RYT-200, RYT-500, E-RYT"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={formData.avatar_url}
                  onChange={(e) => handleInputChange('avatar_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specialties *
                </label>
                
                {/* Current Specialties */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {specialty}
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialty(specialty)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add New Specialty */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a specialty"
                  />
                  <Button
                    type="button"
                    onClick={handleAddSpecialty}
                    variant="outline"
                    size="sm"
                  >
                    Add
                  </Button>
                </div>

                {/* Common Specialties */}
                <div className="text-sm text-gray-600 mb-2">Quick add:</div>
                <div className="flex flex-wrap gap-2">
                  {commonSpecialties.map((specialty) => (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() => {
                        if (!formData.specialties.includes(specialty)) {
                          setFormData(prev => ({
                            ...prev,
                            specialties: [...prev.specialties, specialty]
                          }))
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        formData.specialties.includes(specialty)
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                      disabled={formData.specialties.includes(specialty)}
                    >
                      {specialty}
                    </button>
                  ))}
                </div>
                {errors.specialties && <p className="text-red-500 text-sm mt-1">{errors.specialties}</p>}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active Instructor
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  className="flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : (editingInstructor ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructors List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No instructors yet</h3>
            <p className="text-gray-600 mb-4">Add your first instructor to get started.</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Instructor
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {instructors.map((instructor) => (
              <div
                key={instructor.id}
                className={`border rounded-lg p-6 hover:shadow-md transition-shadow ${
                  instructor.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {instructor.avatar_url ? (
                      <img
                        src={instructor.avatar_url}
                        alt={instructor.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{instructor.full_name}</h3>
                      {instructor.certification && (
                        <p className="text-sm text-blue-600 flex items-center">
                          <Award className="w-3 h-3 mr-1" />
                          {instructor.certification}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(instructor)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(instructor)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove Instructor Role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{instructor.bio}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Experience:</span>
                    <span className="text-sm font-medium">{instructor.experience_years} years</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Email:</span>
                    <span className="text-sm">{instructor.email}</span>
                  </div>

                  {instructor.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Phone:</span>
                      <span className="text-sm">{instructor.phone}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      instructor.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {instructor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {instructor.specialties.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Specialties:</p>
                    <div className="flex flex-wrap gap-1">
                      {instructor.specialties.slice(0, 3).map((specialty, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                        >
                          {specialty}
                        </span>
                      ))}
                      {instructor.specialties.length > 3 && (
                        <span className="text-gray-500 text-xs">
                          +{instructor.specialties.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}