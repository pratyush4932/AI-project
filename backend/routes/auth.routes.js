import express from "express";
import {
	sendSignupOTP,
	verifySignupOTP,
	sendSigninOTP,
	verifySigninOTP,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup/send-otp", sendSignupOTP);
router.post("/signup/verify-otp", verifySignupOTP);

router.post("/signin/send-otp", sendSigninOTP);
router.post("/signin/verify-otp", verifySigninOTP);

export default router;