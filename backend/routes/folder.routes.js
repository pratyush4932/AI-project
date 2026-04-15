import express from "express";
import { createFolder, getFolders, deleteFolder } from "../controllers/folder.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/create", createFolder);
router.get("/", getFolders);
router.delete("/:folder_id", deleteFolder);

export default router;
