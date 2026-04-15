import { uploadFile } from "../services/storage.service.js";
import { supabase } from "../config/supabase.js";

/**
 * Detect file type based on extension
 * @param {string} filename - Original filename
 * @returns {string} MIME type
 */
const getFileType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Generate storage path based on upload type
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @param {boolean} isHospitalUpload - Is this a hospital upload
 * @param {string} hospitalId - Hospital ID (if hospital upload)
 * @param {string} visitDate - Visit date (if hospital upload)
 * @returns {string} Storage path
 */
const generateStoragePath = (userId, filename, isHospitalUpload, hospitalId, visitDate) => {
  if (isHospitalUpload) {
    return `${hospitalId}/${visitDate}/${userId}/${filename}`;
  }
  return `${userId}/personal/${filename}`;
};

/**
 * Upload medical record with support for patient and hospital uploads
 * 
 * CASE 1: Patient Upload (folder_id provided)
 * - Store in user's personal folder or specified folder
 * - source = "patient", hospital_id = null, visit_date = null
 * 
 * CASE 2: Hospital Upload (hospital_id provided)
 * - Auto-set visit_date = today
 * - source = "hospital", folder_id = null
 * - Path: ${hospital_id}/${visit_date}/${user_id}/${filename}
 * 
 * POST /records/upload
 * Body: { folder_id?, hospital_id? }
 */
export const uploadRecord = async (req, res, next) => {
  try {
    // Validate file existence
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { folder_id, hospital_id } = req.body;
    const userId = req.user.id;
    const filename = req.file.originalname;
    const fileType = getFileType(filename);

    // Determine upload type
    const isHospitalUpload = !!hospital_id;

    // Build record data object
    let recordData = {
      user_id: userId,
      file_type: fileType,
      uploaded_by: userId,
    };

    let storagePath;

    if (isHospitalUpload) {
      // CASE 2: Hospital Upload
      const visitDate = getTodayDate();

      recordData = {
        ...recordData,
        hospital_id,
        visit_date: visitDate,
        folder_id: null,
        source: "hospital",
      };

      storagePath = generateStoragePath(userId, filename, true, hospital_id, visitDate);

      console.log(
        `[HOSPITAL_UPLOAD] Hospital: ${hospital_id}, Visit: ${visitDate}, User: ${userId}, File: ${filename}`
      );
    } else {
      // CASE 1: Patient Upload
      recordData = {
        ...recordData,
        folder_id: folder_id || null,
        hospital_id: null,
        visit_date: null,
        source: "patient",
      };

      storagePath = generateStoragePath(userId, filename, false);

      console.log(
        `[PATIENT_UPLOAD] User: ${userId}, Folder: ${folder_id || 'none'}, File: ${filename}`
      );
    }

    // Upload file to storage service
    const fileUrl = await uploadFile(req.file, storagePath);
    recordData.file_url = fileUrl;

    // Insert record into database
    const { data, error } = await supabase
      .from("records")
      .insert([recordData])
      .select();

    if (error) throw error;

    console.log(
      `[RECORD_CREATED] ID: ${data[0]?.id}, Source: ${recordData.source}, User: ${userId}`
    );

    res.status(201).json({ record: data[0] });

  } catch (err) {
    console.error("[UPLOAD_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all records for a specific user by user_id with structured response
 * GET /records/user/:userId
 * Returns: user details, folders with records, and hospital visits
 */
export const getRecordsByUserId = async (req, res, next) => {
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
    const { data: records, error: recordsError } = await supabase
      .from("records")
      .select(`
        *,
        folder:folder_id (
          id,
          name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (recordsError) throw recordsError;

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
            hospital_name: record.hospital_name || "Hospital",
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

    console.log(`[FETCH_RECORDS] User: ${userId}, Total: ${records?.length || 0}, Folders: ${Object.keys(folders).length}, Hospitals: ${hospitalViewArray.length}`);

    res.json({
      user: userData,
      records_view: {
        folders: Object.values(folders),
      },
      hospital_view: hospitalViewArray,
    });

  } catch (err) {
    console.error("[FETCH_RECORDS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all records for a user by phone number with structured response
 * GET /records/user/phone/:phone
 * Returns: user details, folders with records, and hospital visits
 */
export const getRecordsByPhone = async (req, res, next) => {
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
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userData.id;

    // Fetch all records for this user
    const { data: records, error: recordsError } = await supabase
      .from("records")
      .select(`
        *,
        folder:folder_id (
          id,
          name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (recordsError) throw recordsError;

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
            hospital_name: record.hospital_name || "Hospital",
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

    console.log(`[FETCH_RECORDS_BY_PHONE] Phone: ${phone}, User: ${userId}, Total: ${records?.length || 0}, Folders: ${Object.keys(folders).length}, Hospitals: ${hospitalViewArray.length}`);

    res.json({
      user: userData,
      records_view: {
        folders: Object.values(folders),
      },
      hospital_view: hospitalViewArray,
    });

  } catch (err) {
    console.error("[FETCH_RECORDS_BY_PHONE_ERROR]", err.message);
    next(err);
  }
};