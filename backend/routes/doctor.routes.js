import express from "express";
import { sendDoctorOTP, verifyDoctorOTP, getDoctorProfile } from "../controllers/doctor.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Doctor Auth - OTP based
router.post("/send-otp", sendDoctorOTP);
router.post("/verify-otp", verifyDoctorOTP);

// Doctor endpoints (requires auth)
router.get("/profile", authMiddleware, getDoctorProfile);

export default router;
