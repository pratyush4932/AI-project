import express from "express";
import { getUserProfile, getUserProfileByPhone, getMyProfile } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get current user profile
router.get("/me", authMiddleware, getMyProfile);

// Get user profile by ID
router.get("/:userId", authMiddleware, getUserProfile);

// Get user profile by Phone
router.get("/phone/:phone", authMiddleware, getUserProfileByPhone);

export default router;
