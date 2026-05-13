import { supabase } from "../config/supabase.js";

/**
 * Get all available doctors with their specializations and hospitals
 * GET /appointments/doctors
 * Auth: Patient token required (or any authenticated user)
 */
export const getAvailableDoctors = async (req, res, next) => {
  try {
    const { data: doctors, error } = await supabase
      .from("hospital_users")
      .select(`
        specialization,
        hospital_id,
        hospitals ( name ),
        user_id,
        users ( name )
      `)
      .eq("role", "doctor");

    if (error) throw error;

    const formattedDoctors = (doctors || []).map((record) => ({
      doctor_id: record.user_id,
      doctor_name: record.users?.name,
      specialization: record.specialization || "General Physician",
      hospital_id: record.hospital_id,
      hospital_name: record.hospitals?.name
    }));

    res.json({
      doctors: formattedDoctors
    });
  } catch (err) {
    console.error("[GET_AVAILABLE_DOCTORS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Request an appointment
 * POST /appointments/request
 * Auth: Patient token required
 * Body: { doctor_id, hospital_id, appointment_date, time_slot }
 */
export const requestAppointment = async (req, res, next) => {
  try {
    const { doctor_id, hospital_id, appointment_date, time_slot } = req.body;
    const patient_id = req.user.id;

    if (!doctor_id || !hospital_id || !appointment_date || !time_slot) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert([{
        patient_id,
        doctor_id,
        hospital_id,
        appointment_date,
        time_slot,
        status: "pending"
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Appointment requested successfully",
      appointment: data
    });
  } catch (err) {
    console.error("[REQUEST_APPOINTMENT_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get patient's appointments
 * GET /appointments/patient
 * Auth: Patient token required
 */
export const getPatientAppointments = async (req, res, next) => {
  try {
    const patient_id = req.user.id;

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        doctor:users!appointments_doctor_id_fkey ( name ),
        hospital:hospitals ( name )
      `)
      .eq("patient_id", patient_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ appointments: data || [] });
  } catch (err) {
    console.error("[GET_PATIENT_APPOINTMENTS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Get hospital's appointments
 * GET /appointments/hospital
 * Auth: Hospital token required
 */
export const getHospitalAppointments = async (req, res, next) => {
  try {
    const hospital_id = req.user.hospital_id;

    if (!hospital_id) {
      return res.status(403).json({ error: "Hospital access required" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patient:users!appointments_patient_id_fkey ( name, phone ),
        doctor:users!appointments_doctor_id_fkey ( name )
      `)
      .eq("hospital_id", hospital_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ appointments: data || [] });
  } catch (err) {
    console.error("[GET_HOSPITAL_APPOINTMENTS_ERROR]", err.message);
    next(err);
  }
};

/**
 * Update appointment status (Accept/Reject)
 * PATCH /appointments/hospital/:id/status
 * Auth: Hospital token required
 * Body: { status } - 'accepted', 'rejected', 'completed', 'cancelled'
 */
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const hospital_id = req.user.hospital_id;

    if (!hospital_id) {
      return res.status(403).json({ error: "Hospital access required" });
    }

    const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Verify the appointment belongs to this hospital
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("id, hospital_id")
      .eq("id", id)
      .single();
      
    if (fetchError || !appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    if (appointment.hospital_id !== hospital_id) {
      return res.status(403).json({ error: "Unauthorized to update this appointment" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: `Appointment status updated to ${status}`,
      appointment: data
    });
  } catch (err) {
    console.error("[UPDATE_APPOINTMENT_STATUS_ERROR]", err.message);
    next(err);
  }
};
