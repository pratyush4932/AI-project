import express from "express";
import { createFolder, getFolders, deleteFolder, deleteFolderFile } from "../controllers/folder.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/create", createFolder);
router.get("/", getFolders);
router.delete("/:folder_id", deleteFolder);
router.delete("/:folder_id/files/:record_id", deleteFolderFile);

export default router;
