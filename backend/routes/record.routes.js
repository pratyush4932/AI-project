import express from "express";
import multer from "multer";
import { uploadRecord, getRecordsByUserId, getRecordsByPhone } from "../controllers/record.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer();

router.post("/upload", authMiddleware, upload.single("file"), uploadRecord);
router.get("/user/:userId", getRecordsByUserId);
router.get("/user/phone/:phone", getRecordsByPhone);

export default router;