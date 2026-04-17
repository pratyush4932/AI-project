import express from "express";
import multer from "multer";
import { uploadRecord, getRecordsByUserId, getRecordsByPhone, deleteRecord } from "../controllers/record.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer();

router.post("/upload", authMiddleware, upload.single("file"), uploadRecord);
router.get("/user/:userId", authMiddleware, getRecordsByUserId);
router.get("/user/phone/:phone", authMiddleware, getRecordsByPhone);
router.delete("/:record_id", authMiddleware, deleteRecord);

export default router;