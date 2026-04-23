import { supabase } from "../config/supabase.js";
import { generateToken } from "../utils/jwt.js";
import { sendOTPService, verifyOTPService } from "../services/twilio.service.js";
import { validatePhone } from "../utils/validators.js";
import fs from "fs";
import path from "path";
import { generateFileHash } from "../utils/hash.js";
import { addAiJob } from "../queues/aiQueue.js";

/**
 * Send OTP for Hospital Registration/Login
 * POST /hospital/send-otp
 * Body: { phone }
 */
export const sendHospitalOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    await sendOTPService(phone);

    res.json({ message: "OTP sent to hospital phone" });
  } catch (err) {
    console.error("[SEND_HOSPITAL_OTP_ERROR]", err.message);
    next(err);
  }
};

/**
 * Verify OTP for Hospital Registration/Login
 * POST /hospital/verify-otp
 * Body: { phone, otp, name (required for new hospital), address?, license_no? }
 */
export const verifyHospitalOTP = async (req, res, next) => {
  try {
    const { phone, otp, name, address, license_no } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Verify OTP
    const check = await verifyOTPService(phone, otp);

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if hospital exists
    let { data: hospitalUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("role", "hospital")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (hospitalUser) {
      // Existing hospital - look up hospital_id from hospitals table by name
      const { data: hospitalRecord, error: lookupError } = await supabase
        .from("hospitals")
        .select("id")
        .eq("name", hospitalUser.name)
        .maybeSingle();
      
      let hospitalId = hospitalRecord?.id;
      
      // If hospital record not found, create one
      if (!hospitalId) {
        const { data: newHospital } = await supabase
          .from("hospitals")
          .insert([{ name: hospitalUser.name }])
          .select()
          .single();
        
        hospitalId = newHospital?.id;
      }
      
      const token = generateToken({
        id: hospitalUser.id,
        phone,
        role: "hospital",
        hospital_id: hospitalId,
      });

      console.log(`[HOSPITAL_LOGIN] ID: ${hospitalUser.id}, Phone: ${phone}, Hospital: ${hospitalId}`);

      res.json({
        token,
        hospital: {
          id: hospitalUser.id,
          name: hospitalUser.name,
          phone,
          role: "hospital",
          is_new: false,
        },
      });
    } else {
      // New hospital registration
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Name is required for hospital registration" });
      }

      // Create hospital user
      const { data: newHospitalUser, error: userError } = await supabase
        .from("users")
        .insert([
          {
            phone,
            name: name.trim(),
            role: "hospital",
          }
        ])
        .select()
        .single();

      if (userError) throw userError;

      // Create hospital record
      const { data: hospital, error: hospitalError } = await supabase
        .from("hospitals")
        .insert([{ name: name.trim() }])
        .select()
        .single();

      if (hospitalError) throw hospitalError;

      const token = generateToken({
        id: newHospitalUser.id,
        phone,
        role: "hospital",
        hospital_id: hospital.id,
      });

      console.log(`[HOSPITAL_REGISTERED] ID: ${newHospitalUser.id}, Name: ${name}, Phone: ${phone}, Hospital: ${hospital.id}`);

      res.status(201).json({
        token,
        hospital: {
          id: newHospitalUser.id,
          name,
          phone,
          role: "hospital",
          is_new: true,
        },
      });
    }

  } catch (err) {
    console.error("[VERIFY_HOSPITAL_OTP_ERROR]", err.message);
    next(err);
  }
};

/**
 * Add Doctor to Hospital
 * POST /hospital/doctors/add
 * Body: { name, phone, specialization, license_no }
 * Auth: Hospital token required
 */
export const addDoctor = async (req, res, next) => {
  try {
    const { name, phone, specialization, license_no } = req.body;
    const hospitalUserId = req.user.id;
    let hospitalId = req.user.hospital_id; // From JWT token

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    // Check if doctor phone already exists
    const { data: existingDoctor, error: checkError } = await supabase
      .from("users")
      .select("id, role")
      .eq("phone", phone)
      .maybeSingle();

    if (checkError) throw checkError;

    let doctorUserId;

    if (existingDoctor) {
      if (existingDoctor.role !== "doctor") {
        return res.status(400).json({ error: `User with this phone exists but is registered as ${existingDoctor.role}` });
      }
      doctorUserId = existingDoctor.id;
      console.log(`[DOCTOR_EXISTS] ID: ${doctorUserId}, Name: ${name}`);
    } else {
      // Create doctor user
      const { data: doctorUser, error: userError } = await supabase
        .from("users")
        .insert([{ phone, name, role: "doctor" }])
        .select()
        .single();
      if (userError) throw userError;
      doctorUserId = doctorUser.id;
      console.log(`[DOCTOR_CREATED] ID: ${doctorUserId}, Name: ${name}`);
    }

    // Check if already in hospital_users
    const { data: existingLink, error: linkError } = await supabase
      .from("hospital_users")
      .select("id")
      .eq("hospital_id", hospitalId)
      .eq("user_id", doctorUserId)
      .eq("role", "doctor")
      .maybeSingle();

    if (linkError) throw linkError;

    if (!existingLink) {
      // Create hospital_users entry
      const { error: hospUserError } = await supabase
        .from("hospital_users")
        .insert([{ hospital_id: hospitalId, user_id: doctorUserId, role: "doctor" }]);
      if (hospUserError) throw hospUserError;
    }

    res.status(existingDoctor ? 200 : 201).json({
      doctor: {
        id: doctorUserId,
        name,
        phone,
        specialization,
        hospital_id: hospitalId,
        message: existingDoctor
          ? "Doctor already exists and has been successfully linked to the hospital."
          : "Doctor added successfully. They can now login with their phone and OTP.",
      },
    });

  } catch (err) {
    console.error("[ADD_DOCTOR_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all doctors in hospital
 * GET /hospital/doctors
 * Auth: Hospital token required
 */
export const getHospitalDoctors = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospital_id; // From JWT token

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    const { data: doctors, error } = await supabase
      .from("hospital_users")
      .select(`
        user:user_id (id, name, phone, role),
        role,
        created_at
      `)
      .eq("hospital_id", hospitalId)
      .eq("role", "doctor")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedDoctors = (doctors || []).map((record) => ({
      id: record.user.id,
      name: record.user.name,
      phone: record.user.phone,
      specialization: "N/A",
      license_no: "N/A",
      status: "active",
      created_at: record.created_at,
    }));

    console.log(`[GET_DOCTORS] Hospital: ${hospitalId}, Count: ${formattedDoctors?.length || 0}`);

    res.json({
      hospital_id: hospitalId,
      total: formattedDoctors?.length || 0,
      doctors: formattedDoctors || [],
    });

  } catch (err) {
    console.error("[GET_DOCTORS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Add Patient to Hospital
 * POST /hospital/patients/add
 * Body: { phone }
 * Auth: Hospital token required
 * Fetches patient details from users table
 */
export const addPatientToHospital = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const hospitalUserId = req.user.id;
    const hospitalId = req.user.hospital_id; // From JWT token

    if (!phone) {
      return res.status(400).json({ error: "Patient phone is required" });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    // Get patient from users table
    const { data: patient, error: patientError } = await supabase
      .from("users")
      .select("id, name, phone, role")
      .eq("phone", phone)
      .maybeSingle();

    if (patientError) throw patientError;

    // Patient must exist
    if (!patient) {
      return res.status(404).json({
        error: "Patient not found",
        message: "Patient with this phone number does not exist in the system",
        action: "Please ensure the patient has registered/signed up first"
      });
    }

    // Patient must have role="patient"
    if (patient.role !== "patient") {
      return res.status(400).json({
        error: "Invalid user type",
        message: `User with phone ${phone} exists but is registered as ${patient.role}, not as a patient`
      });
    }

    // Check if patient is already added to this hospital
    const { data: existingRelation, error: relationCheckError } = await supabase
      .from("hospital_users")
      .select("id")
      .eq("hospital_id", hospitalId)
      .eq("user_id", patient.id)
      .eq("role", "patient")
      .maybeSingle();

    if (relationCheckError) throw relationCheckError;

    if (existingRelation) {
      return res.status(409).json({
        error: "Patient already added",
        message: `Patient ${patient.name} is already registered with this hospital`
      });
    }

    // Add patient to hospital
    const { error: addError } = await supabase
      .from("hospital_users")
      .insert([
        {
          hospital_id: hospitalId,
          user_id: patient.id,
          role: "patient",
        }
      ]);

    if (addError) throw addError;

    console.log(`[PATIENT_ADDED_TO_HOSPITAL] PatientID: ${patient.id}, Name: ${patient.name}, HospitalID: ${hospitalId}`);

    res.status(201).json({
      message: "Patient added to hospital successfully",
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        role: patient.role,
      },
      hospital_id: hospitalId,
    });

  } catch (err) {
    console.error("[ADD_PATIENT_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all patients in hospital
 * GET /hospital/patients
 * Auth: Hospital token required
 */
export const getHospitalPatients = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospital_id; // From JWT token

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    const { data: patients, error } = await supabase
      .from("hospital_users")
      .select(`
        user:user_id (id, name, phone, role),
        role,
        created_at
      `)
      .eq("hospital_id", hospitalId)
      .eq("role", "patient")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedPatients = (patients || []).map((record) => ({
      id: record.user.id,
      name: record.user.name,
      phone: record.user.phone,
      status: "active",
      added_at: record.created_at,
    }));

    console.log(`[GET_PATIENTS] Hospital: ${hospitalId}, Count: ${formattedPatients?.length || 0}`);

    res.json({
      hospital_id: hospitalId,
      total: formattedPatients?.length || 0,
      patients: formattedPatients || [],
    });

  } catch (err) {
    console.error("[GET_PATIENTS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get all hospital information in structured format
 * GET /hospital/info
 * Auth: Hospital token required
 * Returns: Hospital details, staff, patients with visits and records
 */
export const getHospitalFullInfo = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospital_id; // From JWT token

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    // Get hospital info
    const { data: hospital, error: hospError } = await supabase
      .from("hospitals")
      .select("id, name, created_at")
      .eq("id", hospitalId)
      .single();

    if (hospError) throw hospError;

    if (!hospital) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    // Get all staff (doctors)
    const { data: staffData, error: staffError } = await supabase
      .from("hospital_users")
      .select(`
        user:user_id (id, name, phone),
        role,
        created_at
      `)
      .eq("hospital_id", hospitalId)
      .eq("role", "doctor")
      .order("created_at", { ascending: false });

    if (staffError) throw staffError;

    const staff = (staffData || []).map((record) => ({
      user_id: record.user.id,
      name: record.user.name,
      phone: record.user.phone,
      role: record.role,
    }));

    // Get all patients
    const { data: patientData, error: patientError } = await supabase
      .from("hospital_users")
      .select("user_id, created_at")
      .eq("hospital_id", hospitalId)
      .eq("role", "patient")
      .order("created_at", { ascending: false });

    if (patientError) throw patientError;

    // Build patients array with visits and records
    const patients = [];

    for (const patientRecord of patientData || []) {
      const userId = patientRecord.user_id;

      // Get patient info
      const { data: patientUser, error: userError } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("id", userId)
        .single();

      if (userError) throw userError;

      // Get all records for this patient in this hospital
      const { data: records, error: recordError } = await supabase
        .from("records")
        .select("id, visit_date, file_url, file_type, ai_summary, created_at")
        .eq("user_id", userId)
        .eq("hospital_id", hospitalId)
        .order("visit_date", { ascending: false });

      if (recordError) throw recordError;

      // Group records by visit_date
      const visitMap = {};
      (records || []).forEach((record) => {
        const visitDate = record.visit_date || new Date(record.created_at).toISOString().split('T')[0];
        
        if (!visitMap[visitDate]) {
          visitMap[visitDate] = [];
        }

        visitMap[visitDate].push({
          id: record.id,
          file_url: record.file_url,
          file_type: record.file_type,
          created_at: record.created_at,
          ai_summary: record.ai_summary || {},
        });
      });

      // Convert visit map to array
      const visits = Object.entries(visitMap).map(([date, recordsList]) => ({
        date,
        records: recordsList,
      }));

      patients.push({
        user_id: patientUser.id,
        name: patientUser.name,
        phone: patientUser.phone,
        visits,
      });
    }

    console.log(`[GET_HOSPITAL_INFO] Hospital: ${hospitalId}, Staff: ${staff.length}, Patients: ${patients.length}`);

    res.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        created_at: hospital.created_at,
      },
      staff,
      patients,
    });

  } catch (err) {
    console.error("[GET_HOSPITAL_INFO_ERROR]", err.message);
    next(err);
  }
};

/**
 * Upload medical record for a patient
 * POST /hospital/patients/:phone/records
 * Auth: Hospital token required
 * File: Multipart form data with "file" field
 * Body: { visit_date? } - If not provided, uses today's date
 */
export const uploadPatientRecord = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const { visit_date } = req.body;
    const hospitalId = req.user.hospital_id;

    // Validate file
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    // Validate phone
    if (!phone) {
      return res.status(400).json({ error: "Patient phone is required" });
    }

    // Get patient from users table
    const { data: patient, error: patientError } = await supabase
      .from("users")
      .select("id, name, phone, role")
      .eq("phone", phone)
      .maybeSingle();

    if (patientError) throw patientError;

    if (!patient) {
      return res.status(404).json({
        error: "Patient not found",
        action: "Please ensure the patient has registered/signed up first"
      });
    }

    if (patient.role !== "patient") {
      return res.status(400).json({
        error: "Invalid user type",
        message: `User is registered as ${patient.role}, not as a patient`
      });
    }

    // Check if patient is in this hospital
    const { data: relation, error: relationError } = await supabase
      .from("hospital_users")
      .select("id")
      .eq("hospital_id", hospitalId)
      .eq("user_id", patient.id)
      .eq("role", "patient")
      .maybeSingle();

    if (relationError) throw relationError;

    if (!relation) {
      return res.status(403).json({
        error: "Patient not in hospital",
        message: `Patient ${patient.name} is not registered with this hospital`
      });
    }

    // Prepare file upload
    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    const fileType = getFileTypeFromExt(ext);
    const recordVisitDate = visit_date || getTodayDate();
    const storagePath = `${hospitalId}/${recordVisitDate}/${patient.id}/${filename}`;

    // Upload file to storage
    const fileUrl = await uploadFileService(req.file, storagePath);

    // Create record in database
    const { data: record, error: recordError } = await supabase
      .from("records")
      .insert([{
        user_id: patient.id,
        hospital_id: hospitalId,
        visit_date: recordVisitDate,
        file_url: fileUrl,
        file_type: fileType,
        source: "hospital",
        uploaded_by: req.user.id,
      }])
      .select()
      .single();

    if (recordError) throw recordError;

    console.log(`[PATIENT_RECORD_UPLOAD] Hospital: ${hospitalId}, Patient: ${patient.id}, File: ${filename}, Date: ${recordVisitDate}`);

    const recordId = record.id;

    // Trigger AI Summarization
    if (recordId) {
      try {
        const tempDir = "uploads/documents/";
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `${Date.now()}-${filename}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        const fileHash = await generateFileHash(tempFilePath);

        // Check cache first
        const { data: cachedData } = await supabase
          .from("ai_summaries_cache")
          .select("summary")
          .eq("file_hash", fileHash)
          .single();

        if (cachedData && cachedData.summary) {
          console.log(`[AI_CACHE_HIT] Record: ${recordId}, Hash: ${fileHash}`);
          // Update record immediately
          await supabase
            .from("records")
            .update({ ai_summary: cachedData.summary })
            .eq("id", recordId);
          
          // Cleanup temp file
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } else {
          console.log(`[AI_QUEUE_TRIGGER] Record: ${recordId}, File: ${filename}`);
          // Add to queue
          await addAiJob({
            filePath: tempFilePath,
            mimetype: fileType,
            fileHash: fileHash,
            originalname: filename,
            recordId: recordId,
          });
        }
      } catch (aiError) {
        console.error("[AI_TRIGGER_ERROR]", aiError.message);
        // Don't fail the upload if AI trigger fails
      }
    }

    res.status(201).json({
      message: "Record uploaded successfully",
      record: {
        id: record.id,
        patient_name: patient.name,
        patient_phone: patient.phone,
        file_url: record.file_url,
        file_type: record.file_type,
        visit_date: record.visit_date,
        uploaded_at: record.created_at,
      },
    });

  } catch (err) {
    console.error("[UPLOAD_PATIENT_RECORD_ERROR]", err.message);
    next(err);
  }
};

/**
 * Helper: Get MIME type from file extension
 */
const getFileTypeFromExt = (ext) => {
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
 * Helper: Get today's date in YYYY-MM-DD format
 */
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Helper: Upload file to storage service
 */
const uploadFileService = async (file, path) => {
  const { data, error } = await supabase.storage
    .from("records")
    .upload(path, file.buffer);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("records")
    .getPublicUrl(path);

  return urlData.publicUrl;
};

/**
 * Delete a doctor from hospital
 * DELETE /hospital/doctors/:doctor_id
 * Auth: Hospital token required
 */
export const deleteDoctor = async (req, res, next) => {
  try {
    const { doctor_id } = req.params;
    const hospitalId = req.user.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    if (!doctor_id) {
      return res.status(400).json({ error: "Doctor ID is required" });
    }

    // Verify the doctor belongs to this hospital
    const { data: hospitalUser, error: checkError } = await supabase
      .from("hospital_users")
      .select("id, user_id, role")
      .eq("hospital_id", hospitalId)
      .eq("user_id", doctor_id)
      .eq("role", "doctor")
      .single();

    if (checkError || !hospitalUser) {
      return res.status(404).json({ error: "Doctor not found in this hospital" });
    }

    // Delete the hospital_users record (doctor association)
    const { error: deleteError } = await supabase
      .from("hospital_users")
      .delete()
      .eq("id", hospitalUser.id);

    if (deleteError) throw deleteError;

    console.log(`[DOCTOR_DELETED] DoctorID: ${doctor_id}, HospitalID: ${hospitalId}`);

    res.json({ message: "Doctor removed from hospital successfully" });

  } catch (err) {
    console.error("[DELETE_DOCTOR_ERROR]", err.message);
    next(err);
  }
};

/**
 * Delete a patient from hospital
 * DELETE /hospital/patients/:patient_id
 * Auth: Hospital token required
 */
export const deletePatient = async (req, res, next) => {
  try {
    const { patient_id } = req.params;
    const hospitalId = req.user.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    // Verify the patient belongs to this hospital
    const { data: hospitalUser, error: checkError } = await supabase
      .from("hospital_users")
      .select("id, user_id, role")
      .eq("hospital_id", hospitalId)
      .eq("user_id", patient_id)
      .eq("role", "patient")
      .single();

    if (checkError || !hospitalUser) {
      return res.status(404).json({ error: "Patient not found in this hospital" });
    }

    // Delete the hospital_users record (patient association)
    const { error: deleteError } = await supabase
      .from("hospital_users")
      .delete()
      .eq("id", hospitalUser.id);

    if (deleteError) throw deleteError;

    console.log(`[PATIENT_DELETED_FROM_HOSPITAL] PatientID: ${patient_id}, HospitalID: ${hospitalId}`);

    res.json({ message: "Patient removed from hospital successfully" });

  } catch (err) {
    console.error("[DELETE_PATIENT_ERROR]", err.message);
    next(err);
  }
};

/**
 * Delete all documents of a patient in hospital
 * DELETE /hospital/patients/:patient_id/documents
 * Auth: Hospital token required
 * Query: visit_date? (optional, delete specific visit documents)
 */
export const deletePatientDocuments = async (req, res, next) => {
  try {
    const { patient_id } = req.params;
    const { visit_date } = req.query;
    const hospitalId = req.user.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ error: "Hospital not found. Hospital user must be authenticated." });
    }

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    // Verify the patient belongs to this hospital
    const { data: hospitalUser, error: checkError } = await supabase
      .from("hospital_users")
      .select("id")
      .eq("hospital_id", hospitalId)
      .eq("user_id", patient_id)
      .eq("role", "patient")
      .single();

    if (checkError || !hospitalUser) {
      return res.status(404).json({ error: "Patient not found in this hospital" });
    }

    // Build query to delete records
    let query = supabase
      .from("records")
      .delete()
      .eq("user_id", patient_id)
      .eq("hospital_id", hospitalId)
      .eq("source", "hospital");

    // If visit_date is provided, delete only documents from that specific visit
    if (visit_date) {
      query = query.eq("visit_date", visit_date);
    }

    const { error: deleteError } = await query;

    if (deleteError) throw deleteError;

    console.log(`[PATIENT_DOCUMENTS_DELETED] PatientID: ${patient_id}, HospitalID: ${hospitalId}, VisitDate: ${visit_date || "all"}`);

    res.json({ 
      message: visit_date ? `Documents from ${visit_date} deleted successfully` : "All documents deleted successfully"
    });

  } catch (err) {
    console.error("[DELETE_PATIENT_DOCUMENTS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Hospital Signout
 * POST /hospital/signout
 * Auth: Hospital token required
 */
export const hospitalSignout = async (req, res, next) => {
  try {
    // In JWT-based auth, signout is primarily a client-side action
    // Server validates token expiration
    // For additional security, you could log logout events or blacklist tokens

    console.log(`[HOSPITAL_SIGNOUT] HospitalID: ${req.user.id}`);

    res.json({ 
      message: "Hospital signed out successfully",
      note: "Please discard the token on the client side"
    });

  } catch (err) {
    console.error("[HOSPITAL_SIGNOUT_ERROR]", err.message);
    next(err);
  }
};