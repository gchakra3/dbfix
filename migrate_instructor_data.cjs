// migrate_instructor_data.cjs
const { createClient } = require('@supabase/supabase-js');

// Load Supabase environment variables
require('dotenv').config(); // Make sure you have dotenv installed (npm install dotenv) if .env is not loaded by default

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase URL and Anon Key must be set in your environment variables (e.g., .env file).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Do not persist session for a script
  },
});

async function migrateInstructorData() {
  console.log('Starting instructor data migration...');

  try {
    // Fetch all instructors
    console.log('Fetching instructors from the "instructors" table...');
    const { data: instructors, error: fetchInstructorsError } = await supabase
      .from('instructors')
      .select('*');

    if (fetchInstructorsError) {
      throw new Error(`Error fetching instructors: ${fetchInstructorsError.message}`);
    }

    if (!instructors || instructors.length === 0) {
      console.log('No instructors found to migrate. Exiting.');
      return;
    }

    console.log(`Found ${instructors.length} instructors to migrate.`);

    // Get the 'instructor' role ID
    console.log('Fetching "instructor" role ID...');
    const { data: instructorRole, error: fetchRoleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'instructor')
      .single();

    if (fetchRoleError || !instructorRole) {
      throw new Error(`Error fetching 'instructor' role ID: ${fetchRoleError?.message || 'Role not found'}. Please ensure the 'instructor' role exists in your 'roles' table.`);
    }
    const instructorRoleId = instructorRole.id;
    console.log(`'instructor' role ID: ${instructorRoleId}`);

    for (const instructor of instructors) {
      console.log(`Processing instructor: ${instructor.name} (${instructor.email})`);

      // Find the corresponding profile by email
      const { data: profile, error: fetchProfileError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('email', instructor.email)
        .single();

      if (fetchProfileError) {
        console.warn(`  Warning: Profile not found for ${instructor.email}. Skipping this instructor. Error: ${fetchProfileError.message}`);
        continue;
      }

      // Update the profile with instructor data
      const updateData = {
        bio: instructor.bio,
        phone: instructor.phone,
        specialties: instructor.specialties,
        experience_years: instructor.experience_years,
        certification: instructor.certification,
        avatar_url: instructor.avatar_url,
        is_active: instructor.is_active,
        updated_at: new Date().toISOString(), // Update timestamp
      };

      console.log(`  Updating profile for user_id: ${profile.user_id}`);
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', profile.user_id);

      if (updateProfileError) {
        console.error(`  Error updating profile for ${instructor.email}: ${updateProfileError.message}`);
        continue;
      }
      console.log(`  Profile updated successfully for ${instructor.email}.`);

      // Assign 'instructor' role to the user
      console.log(`  Assigning 'instructor' role to user_id: ${profile.user_id}`);
      const { error: assignRoleError } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: profile.user_id, role_id: instructorRoleId },
          { onConflict: 'user_id,role_id' } // Prevent duplicate role assignments
        );

      if (assignRoleError) {
        console.error(`  Error assigning 'instructor' role to ${instructor.email}: ${assignRoleError.message}`);
      } else {
        console.log(`  'instructor' role assigned successfully to ${instructor.email}.`);
      }
    }

    // Delete the instructors table after successful migration
    console.log('All instructors processed. Attempting to delete the "instructors" table...');
    // NOTE: Supabase does not allow dropping tables via client-side API directly.
    // You will need to run this SQL command manually in your Supabase SQL Editor:
    // DROP TABLE public.instructors;
    console.log('Please manually run the following SQL command in your Supabase SQL Editor to remove the old table:');
    console.log('DROP TABLE public.instructors;');

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    // Close Supabase client connection if necessary (not strictly needed for Node.js scripts)
  }
}

// Run the migration function
migrateInstructorData();
