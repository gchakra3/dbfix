import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'

interface ClassSchedule {
  id: string
  class_type_id: string
  instructor_id: string
  day_of_week: number
  start_time: string
  duration_minutes: number
  max_participants: number
  is_active: boolean
  effective_from: string
  effective_until: string | null
  class_type: {
    name: string
    description: string
    difficulty_level: string
    price: number
  }
  instructor: {
    full_name: string
  }
}

export function useClassSchedule() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching class schedules...')

      const { data, error: fetchError } = await supabase
        .from('class_schedules')
        .select(`
          *,
          class_type:class_types(name, description, difficulty_level, price),
          instructor:profiles(full_name, email)
        `)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time')

      if (fetchError) throw fetchError
      
      console.log('📊 Raw schedule data:', data)
      
      // Filter out schedules with invalid instructor data
      const validSchedules = (data || []).filter(schedule => {
        const hasValidInstructor = schedule.instructor?.full_name?.trim() || 
                                  schedule.instructor?.email?.trim()
        
        if (!hasValidInstructor) {
          console.warn('⚠️ Filtering out schedule with invalid instructor:', schedule)
        }
        
        return hasValidInstructor
      }).map(schedule => ({
        ...schedule,
        instructor: {
          ...schedule.instructor,
          full_name: schedule.instructor.full_name?.trim() || 
                    schedule.instructor.email?.split('@')[0]?.replace(/[._]/g, ' ') || 
                    'Unknown Instructor'
        }
      }))
      
      console.log('✅ Valid schedules after filtering:', validSchedules)

      setSchedules(validSchedules)
      console.log('✅ Schedule fetching completed successfully')
    } catch (err: any) {
      console.error('❌ Error fetching class schedules:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayOfWeek]
  }

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return {
    schedules,
    loading,
    error,
    refetch: fetchSchedules,
    getDayName,
    formatTime
  }
}
