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