import { supabase } from "../config/supabase.js";

/**
 * Create a new folder for a patient
 * POST /folders/create
 * Body: { name (required) }
 */
export const createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Validate folder name
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Insert folder into database
    const { data, error } = await supabase
      .from("folders")
      .insert([
        {
          user_id: userId,
          name: name.trim(),
        }
      ])
      .select();

    if (error) throw error;

    console.log(`[FOLDER_CREATED] ID: ${data[0]?.id}, Name: ${name}, User: ${userId}`);

    res.status(201).json({ folder: data[0] });

  } catch (err) {
    console.error("[FOLDER_CREATE_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all folders for a user
 * GET /folders
 */
export const getFolders = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ folders: data });

  } catch (err) {
    console.error("[FOLDER_GET_ERROR]", err.message);
    next(err);
  }
};

/**
 * Delete a folder (soft or hard delete based on business logic)
 * DELETE /folders/:folder_id
 */
export const deleteFolder = async (req, res, next) => {
  try {
    const { folder_id } = req.params;
    const userId = req.user.id;

    // Verify user owns this folder
    const { data: folder, error: fetchError } = await supabase
      .from("folders")
      .select("user_id")
      .eq("id", folder_id)
      .single();

    if (fetchError || !folder || folder.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this folder" });
    }

    // Delete the folder
    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("id", folder_id);

    if (error) throw error;

    console.log(`[FOLDER_DELETED] ID: ${folder_id}, User: ${userId}`);

    res.json({ message: "Folder deleted successfully" });

  } catch (err) {
    console.error("[FOLDER_DELETE_ERROR]", err.message);
    next(err);
  }
};
