import { supabase } from "../config/supabase.js";
import { addSignedUrlsToRecords } from "./record.controller.js";

/**
 * Get all records for a specific user by user_id with structured response
 * GET /user/:userId
 * Returns: user details, folders with records, and hospital visits
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch user details
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, name, phone, role, created_at")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch all records for the user
    const { data: recordsData, error: recordsError } = await supabase
      .from("records")
      .select(`
        *,
        folder:folder_id (
          id,
          name
        ),
        hospital:hospital_id (
          id,
          name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (recordsError) throw recordsError;

    // Attach signed URLs to records
    const records = await addSignedUrlsToRecords(recordsData);

    // Organize records by type
    const folders = {};
    const hospitalVisits = {};

    (records || []).forEach((record) => {
      if (record.source === "patient") {
        // Patient uploads grouped by folder
        const folderKey = record.folder_id || "personal";
        const folderName = record.folder?.name || "Personal";

        if (!folders[folderKey]) {
          folders[folderKey] = {
            id: record.folder_id,
            name: folderName,
            records: [],
          };
        }

        folders[folderKey].records.push({
          id: record.id,
          file_url: record.file_url,
          signed_url: record.signed_url,
          file_type: record.file_type,
          created_at: record.created_at,
          ai_summary: record.ai_summary || {
            key_findings: [],
            medications: [],
            alerts: [],
          },
        });
      } else if (record.source === "hospital") {
        // Hospital uploads grouped by hospital and visit date
        const hospitalKey = record.hospital_id;
        const visitDate = record.visit_date;

        if (!hospitalVisits[hospitalKey]) {
          hospitalVisits[hospitalKey] = {
            hospital_id: record.hospital_id,
            hospital_name: record.hospital?.name || "Hospital",
            visits: {},
          };
        }

        if (!hospitalVisits[hospitalKey].visits[visitDate]) {
          hospitalVisits[hospitalKey].visits[visitDate] = {
            date: visitDate,
            records: [],
          };
        }

        hospitalVisits[hospitalKey].visits[visitDate].records.push({
          id: record.id,
          file_url: record.file_url,
          signed_url: record.signed_url,
          file_type: record.file_type,
          created_at: record.created_at,
          ai_summary: record.ai_summary || {
            key_findings: [],
            medications: [],
            alerts: [],
          },
        });
      }
    });

    // Convert hospital visits object to array
    const hospitalViewArray = Object.values(hospitalVisits).map((hospital) => ({
      hospital_id: hospital.hospital_id,
      hospital_name: hospital.hospital_name,
      visits: Object.values(hospital.visits),
    }));

    console.log(`[USER_PROFILE_FETCH] User: ${userId}, Total: ${records?.length || 0}`);

    res.json({
      user: userData,
      records_view: {
        folders: Object.values(folders),
      },
      hospital_view: hospitalViewArray,
    });

  } catch (err) {
    console.error("[USER_PROFILE_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all records for a user by phone number with structured response
 * GET /user/phone/:phone
 */
export const getUserProfileByPhone = async (req, res, next) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Find user by phone
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, name, phone, role, created_at")
      .eq("phone", phone)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    // Forward to getUserProfile by setting req.params.userId
    req.params.userId = userData.id;
    return getUserProfile(req, res, next);

  } catch (err) {
    console.error("[USER_PROFILE_BY_PHONE_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get current user's profile
 * GET /user/me
 */
export const getMyProfile = async (req, res, next) => {
  try {
    req.params.userId = req.user.id;
    return getUserProfile(req, res, next);
  } catch (err) {
    next(err);
  }
};
