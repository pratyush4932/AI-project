import 'dotenv/config';
import { supabase } from './config/supabase.js';

async function wipeDatabaseAndStorage() {
  console.log('🔄 Starting full database and storage wipe...');

  // 1. Wipe Storage
  const BUCKET_NAME = 'records';
  console.log(`\n📦 Emptying storage bucket: ${BUCKET_NAME}...`);
  try {
    const { data: files, error: listError } = await supabase.storage.from(BUCKET_NAME).list('', {
      limit: 1000,
      offset: 0,
    });
    
    // To list properly across folders, we might need to recursively search, but since the test script uploads to specific paths,
    // let's just attempt to list the root. Supabase storage folder listing can be tricky as it only returns immediate children.
    // However, we can just use the supabase admin API or empty bucket but the generic SDK .emptyBucket() works if available.
    if (supabase.storage.emptyBucket) {
      const { error: emptyError } = await supabase.storage.emptyBucket(BUCKET_NAME);
      if (emptyError) {
         console.error('Error emptying bucket natively (might not be supported):', emptyError.message);
      } else {
         console.log(`✅ Emptied bucket ${BUCKET_NAME} natively`);
      }
    } else {
      console.log('Bucket emptying should be done manually in the dashboard for nested folders.');
    }
  } catch (err) {
    console.error('Failed to clear storage:', err.message);
  }

  // 2. Wipe Tables in Order (Child first, then parent to avoid foreign key violations)
  const tables = [
    'records',        // depends on folders, hospital_users, users
    'folders',        // depends on users
    'hospital_users', // depends on hospitals, users
    'hospitals',
    'users'
  ];

  for (const table of tables) {
    console.log(`\n🧹 Emptying table: ${table}...`);
    try {
      // Fetch all IDs to delete them one by one if .neq causes issues, but we can do a broad match
      const { data, error } = await supabase.from(table).select('id');
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        continue;
      }
      
      if (data && data.length > 0) {
        const ids = data.map(item => item.id);
        const { error: deleteError } = await supabase.from(table).delete().in('id', ids);
        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError.message);
        } else {
          console.log(`✅ Deleted ${ids.length} rows from ${table}`);
        }
      } else {
        console.log(`ℹ️ Table ${table} is already empty.`);
      }
      
    } catch (e) {
      console.error(`Failed to wipe ${table}:`, e.message);
    }
  }

  console.log('\n🎉 Wipe process finished!');
}

wipeDatabaseAndStorage();
