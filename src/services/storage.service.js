import { supabase } from "../config/supabase.js";

export const uploadFile = async (file, path) => {
  const { data, error } = await supabase.storage
    .from("records")
    .upload(path, file.buffer);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("records")
    .getPublicUrl(path);

  return urlData.publicUrl;
};

export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return;
  try {
    const urlParts = fileUrl.split('/public/records/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      const { error } = await supabase.storage.from("records").remove([filePath]);
      if (error) {
        console.error(`[STORAGE_DELETE_ERROR] Failed to delete file ${filePath}:`, error.message);
      } else {
        console.log(`[STORAGE_DELETED] File: ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`[STORAGE_DELETE_ERROR] Exception deleting file ${fileUrl}:`, error.message);
  }
};