// src/features/admin/components/ClassAssignmentManager.tsx

import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { useUserProfiles } from '../../user-profile/hooks/useUserProfiles'

export function ClassAssignmentManager() {
  const { profiles: allProfiles } = useUserProfiles()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch scheduled classes WITHOUT the join
      const { data: classesData, error: classesError } = await supabase
        .from('scheduled_classes')
        .select(`
          *,
          class_type:class_types(name, difficulty_level)
        `)
        .eq('status', 'scheduled')
        .order('start_time')

      if (classesError) throw classesError

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('class_assignments')
        .select('*')

      if (assignmentsError) throw assignmentsError

      // Filter profiles to instructors (with role)
      const filteredProfiles = allProfiles.filter(profile => profile.roles?.includes('instructor'))

      // Enrich assignments
      const enrichedAssignments = (assignmentsData || []).map(assignment => {
        const scheduledClass = classesData?.find(cls => cls.id === assignment.scheduled_class_id)
        if (scheduledClass) {
          const instructorProfile = filteredProfiles.find(profile => profile.user_id === scheduledClass.instructor_id)
          // Attach instructor full_name
          scheduledClass.instructor = {
            full_name: instructorProfile?.full_name || 'Unknown'
          }
        }

        return {
          ...assignment,
          scheduled_class: scheduledClass
        }
      })

      setAssignments(enrichedAssignments)
    } catch (err) {
      console.error('Error fetching data:', err)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [allProfiles])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Class Assignment Manager</h2>
      {/* Render your table or UI here */}
      <ul>
        {assignments.map(a => (
          <li key={a.id}>
            Class: {a.scheduled_class?.class_type?.name} | 
            Instructor: {a.scheduled_class?.instructor?.full_name}
          </li>
        ))}
      </ul>
    </div>
  )
}
