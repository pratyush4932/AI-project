import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllFiles(bucketName, folderPath = '') {
  const { data, error } = await supabase.storage.from(bucketName).list(folderPath, { limit: 100 });
  if (error) {
    console.error("Error listing files:", error);
    return [];
  }
  
  let allFiles = [];
  for (const item of data) {
    // If id is null, it's a folder
    if (item.id === null) {
      const subFolderPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      const subFiles = await listAllFiles(bucketName, subFolderPath);
      allFiles = allFiles.concat(subFiles);
    } else {
      const filePath = folderPath ? `${folderPath}/${item.name}` : item.name;
      allFiles.push(filePath);
    }
  }
  return allFiles;
}

async function cleanupOrphanedFiles() {
  console.log("Fetching all files in storage bucket 'records'...");
  const allFiles = await listAllFiles('records');
  console.log(`Found ${allFiles.length} files in storage.`);

  console.log("Fetching all records from database...");
  const { data: records, error } = await supabase.from('records').select('file_url');
  if (error) {
    console.error("Error fetching records:", error);
    process.exit(1);
  }
  
  const dbFilePaths = records.map(r => {
    if (!r.file_url) return null;
    const urlParts = r.file_url.split('/public/records/');
    if (urlParts.length > 1) {
      return decodeURIComponent(urlParts[1]);
    }
    return null;
  }).filter(Boolean);

  console.log(`Found ${dbFilePaths.length} file paths in database.`);

  const orphanedFiles = allFiles.filter(f => !dbFilePaths.includes(f));
  
  if (orphanedFiles.length > 0) {
    console.log(`Found ${orphanedFiles.length} orphaned files. Deleting...`);
    const { data, error } = await supabase.storage.from('records').remove(orphanedFiles);
    if (error) {
      console.error("Error deleting files:", error);
    } else {
      console.log("Successfully deleted orphaned files:", orphanedFiles);
    }
  } else {
    console.log("No orphaned files found.");
  }
  
  process.exit(0);
}

cleanupOrphanedFiles();
