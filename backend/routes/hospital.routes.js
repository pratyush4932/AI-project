import express from "express";
import multer from "multer";
import { sendHospitalOTP, verifyHospitalOTP, addDoctor, getHospitalDoctors, addPatientToHospital, getHospitalPatients, getHospitalFullInfo, uploadPatientRecord } from "../controllers/hospital.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer();

// Hospital Auth - OTP based
router.post("/send-otp", sendHospitalOTP);
router.post("/verify-otp", verifyHospitalOTP);

// Hospital management - Doctors (requires auth)
router.post("/doctors/add", authMiddleware, addDoctor);
router.get("/doctors", authMiddleware, getHospitalDoctors);

// Hospital management - Patients (requires auth)
router.post("/patients/add", authMiddleware, addPatientToHospital);
router.get("/patients", authMiddleware, getHospitalPatients);

// Hospital management - Patient Records (requires auth)
router.post("/patients/:phone/records", authMiddleware, upload.single("file"), uploadPatientRecord);

// Hospital info - All data in structured format (requires auth)
router.get("/info", authMiddleware, getHospitalFullInfo);

export default router;