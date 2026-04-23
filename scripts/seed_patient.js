import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function seedPatient() {
  const patientData = {
    phone: '+919876543210',
    name: 'John Doe',
    role: 'patient'
  };

  console.log('🔄 Seeding patient...');

  try {
    // 1. Check if user already exists
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', patientData.phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingUser) {
      console.log(`ℹ️ Patient with phone ${patientData.phone} already exists (ID: ${existingUser.id})`);
      return existingUser;
    }

    // 2. Insert new patient
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([patientData])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`✅ Patient seeded successfully!`);
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Name: ${newUser.name}`);
    console.log(`   Phone: ${newUser.phone}`);

    // 3. Optional: Create a default folder for the patient
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .insert([
        { name: 'General Records', user_id: newUser.id }
      ])
      .select()
      .single();

    if (folderError) {
      console.warn('⚠️ Could not create default folder:', folderError.message);
    } else {
      console.log(`✅ Default folder "General Records" created (ID: ${folder.id})`);
    }

    return newUser;
  } catch (err) {
    console.error('❌ Failed to seed patient:', err.message);
    process.exit(1);
  }
}

seedPatient();
