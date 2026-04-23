import express from "express";
import multer from "multer";
import { sendHospitalOTP, verifyHospitalOTP, addDoctor, getHospitalDoctors, addPatientToHospital, getHospitalPatients, getHospitalFullInfo, uploadPatientRecord, deleteDoctor, deletePatient, deletePatientDocuments, hospitalSignout } from "../controllers/hospital.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer();

// Hospital Auth - OTP based
router.post("/send-otp", sendHospitalOTP);
router.post("/verify-otp", verifyHospitalOTP);

// Hospital signout
router.post("/signout", authMiddleware, hospitalSignout);

// Hospital management - Doctors (requires auth)
router.post("/doctors/add", authMiddleware, addDoctor);
router.get("/doctors", authMiddleware, getHospitalDoctors);
router.delete("/doctors/:doctor_id", authMiddleware, deleteDoctor);

// Hospital management - Patients (requires auth)
router.post("/patients/add", authMiddleware, addPatientToHospital);
router.get("/patients", authMiddleware, getHospitalPatients);
router.delete("/patients/:patient_id", authMiddleware, deletePatient);
router.delete("/patients/:patient_id/documents", authMiddleware, deletePatientDocuments);

// Hospital management - Patient Records (requires auth)
router.post("/patients/:phone/records", authMiddleware, upload.single("file"), uploadPatientRecord);

// Hospital info - All data in structured format (requires auth)
router.get("/info", authMiddleware, getHospitalFullInfo);

export default router;