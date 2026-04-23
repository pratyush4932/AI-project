import express from "express";
import {
	sendSignupOTP,
	verifySignupOTP,
	sendSigninOTP,
	verifySigninOTP,
	patientSignout,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup/send-otp", sendSignupOTP);
router.post("/signup/verify-otp", verifySignupOTP);

router.post("/signin/send-otp", sendSigninOTP);
router.post("/signin/verify-otp", verifySigninOTP);

router.post("/signout", authMiddleware, patientSignout);

export default router;