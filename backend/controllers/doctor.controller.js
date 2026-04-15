import { supabase } from "../config/supabase.js";
import { generateToken } from "../utils/jwt.js";
import { sendOTPService, verifyOTPService } from "../services/twilio.service.js";
import { validatePhone } from "../utils/validators.js";

/**
 * Send OTP for Doctor Login
 * POST /doctor/send-otp
 * Body: { phone }
 * Only doctors added by hospitals can receive OTP
 */
export const sendDoctorOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    // Verify doctor exists
    const { data: doctor, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "doctor")
      .eq("phone", phone)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found. Only doctors added by hospitals can login." });
    }

    await sendOTPService(phone);

    res.json({ message: "OTP sent to doctor phone" });
  } catch (err) {
    console.error("[SEND_DOCTOR_OTP_ERROR]", err.message);
    next(err);
  }
};

/**
 * Verify OTP for Doctor Login
 * POST /doctor/verify-otp
 * Body: { phone, otp }
 * Only doctors added by hospitals can login
 */
export const verifyDoctorOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

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

    // Find doctor user with hospital association
    const { data: doctorUser, error: selectError } = await supabase
      .from("users")
      .select(`
        *,
        hospital_users (
          hospital_id,
          role
        )
      `)
      .eq("role", "doctor")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (!doctorUser) {
      return res.status(401).json({ error: "Doctor not found" });
    }

    // Check if doctor is associated with a hospital
    const hospitalUsers = doctorUser.hospital_users || [];
    if (hospitalUsers.length === 0) {
      return res.status(401).json({ error: "Doctor not associated with any hospital" });
    }

    const hospitalData = hospitalUsers[0];

    // Get hospital details
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("id, name")
      .eq("id", hospitalData.hospital_id)
      .single();

    const metadata = doctorUser.metadata || {};

    const token = generateToken({
      id: doctorUser.id,
      phone,
      role: "doctor",
      hospital_id: hospitalData.hospital_id,
    });

    console.log(`[DOCTOR_LOGIN] ID: ${doctorUser.id}, Phone: ${phone}, Hospital: ${hospitalData.hospital_id}`);

    res.json({
      token,
      doctor: {
        id: doctorUser.id,
        name: doctorUser.name,
        phone,
        specialization: "N/A",
        hospital_id: hospitalData.hospital_id,
        hospital_name: hospital?.name || "Hospital",
        role: "doctor",
      },
    });

  } catch (err) {
    console.error("[VERIFY_DOCTOR_OTP_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get Doctor Profile
 * GET /doctor/profile
 * Auth: Doctor token required
 */
export const getDoctorProfile = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const hospitalId = req.user.hospital_id;

    const { data: doctor, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", doctorId)
      .single();

    if (error || !doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Get hospital details
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("id, name")
      .eq("id", hospitalId)
      .single();

    const metadata = doctor.metadata || {};

    console.log(`[GET_DOCTOR_PROFILE] ID: ${doctorId}`);

    res.json({
      doctor: {
        id: doctor.id,
        name: doctor.name,
        phone: doctor.phone,
        specialization: "N/A",
        license_no: "N/A",
        hospital_id: hospitalId,
        hospital: hospital ? { id: hospital.id, name: hospital.name } : null,
        status: "active",
        created_at: doctor.created_at,
      },
    });

  } catch (err) {
    console.error("[GET_DOCTOR_PROFILE_ERROR]", err.message);
    next(err);
  }
};
