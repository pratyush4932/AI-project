import express from "express";
import { sendDoctorOTP, verifyDoctorOTP, getDoctorProfile, doctorSignout } from "../controllers/doctor.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Doctor Auth - OTP based
router.post("/signin/send-otp", sendDoctorOTP);
router.post("/signin/verify-otp", verifyDoctorOTP);

// Doctor signout
router.post("/signout", authMiddleware, doctorSignout);

// Doctor endpoints (requires auth)
router.get("/profile", authMiddleware, getDoctorProfile);

export default router;
