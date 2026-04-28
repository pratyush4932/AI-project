import express from "express";
import multer from "multer";
import { uploadRecord, deleteRecord } from "../controllers/record.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer();

router.post("/upload", authMiddleware, upload.single("file"), uploadRecord);
router.delete("/:record_id", authMiddleware, deleteRecord);

export default router;