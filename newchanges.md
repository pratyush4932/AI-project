# New Changes: Appointment System Implementation

This document summarizes the recent backend changes made to support the new Patient Appointment System.

## 1. Database Schema (Supabase)

### Table: `hospital_users`
- **Added Column**: `specialization` (TEXT)
- **Default Value**: `'General Physician'`
- **Purpose**: Links a doctor's specialization to their hospital affiliation.

### Table: `appointments` [NEW]
- **Columns**:
  - `id` (UUID, Primary Key)
  - `patient_id` (UUID, FK -> `users.id`)
  - `doctor_id` (UUID, FK -> `users.id`)
  - `hospital_id` (UUID, FK -> `hospitals.id`)
  - `appointment_date` (DATE)
  - `time_slot` (TEXT) - e.g., "17:00-18:00"
  - `status` (TEXT) - Options: `pending`, `accepted`, `rejected`, `completed`, `cancelled`
  - `created_at`, `updated_at` (TIMESTAMPS)
- **Security**: Row Level Security (RLS) enabled.

## 2. Controller & Route Updates

### `src/controllers/hospital.controller.js`
- **`addDoctor`**: Now accepts `specialization`. Defaults to `'General Physician'` if not provided. Updates existing links if the doctor is re-added.
- **`getHospitalDoctors`**: Now returns the `specialization` for each doctor.

### `src/controllers/doctor.controller.js`
- **`verifyDoctorOTP`**: Now includes the doctor's specialization in the login response.
- **`getDoctorProfile`**: Now returns the doctor's specialization based on their hospital link.

### `src/controllers/appointment.controller.js` [NEW]
- **`getAvailableDoctors`**: Consolidates all doctors, specializations, and hospital names into a single API call for the frontend.
- **`requestAppointment`**: Allows patients to submit a pending appointment request.
- **`getPatientAppointments`**: Shows history/status for patients.
- **`getHospitalAppointments`**: Allows hospitals to see incoming requests.
- **`updateAppointmentStatus`**: Endpoint for hospitals to accept or reject requests.

### `src/routes/appointment.routes.js` [NEW]
- Defines the `/appointments` sub-routes for the endpoints listed above.

### `src/server.js`
- Mounted the new `appointmentRoutes` under the `/appointments` path.

## 3. New API Endpoints Summary

| Method | Endpoint | Description | Role |
| :--- | :--- | :--- | :--- |
| GET | `/appointments/doctors` | Get all doctors/specializations | Patient |
| POST | `/appointments/request` | Request an appointment | Patient |
| GET | `/appointments/patient` | View my appointments | Patient |
| GET | `/appointments/hospital` | View appointment requests | Hospital |
| PATCH| `/appointments/hospital/:id/status` | Accept/Reject appointment | Hospital |
