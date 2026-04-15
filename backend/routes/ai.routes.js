const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth.middleware');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only medical documents are allowed: PDF, DOCX, JPG, or PNG files. Please upload medical reports, prescriptions, lab tests, X-rays, or clinical notes.'
        )
      );
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
});

// Routes
// POST /api/ai/summarize - Summarize documents/images with authentication (max 3 files)
router.post(
  '/summarize',
  authMiddleware, // JWT authentication middleware
  upload.array('documents', 3), // Max 3 files
  aiController.summarizeDocument
);

// POST /api/ai/summarize-summaries - Aggregate multiple summaries with authentication (max 10)
router.post(
  '/summarize-summaries',
  authMiddleware, // JWT authentication middleware
  aiController.summarizeSummaries
);

module.exports = router;
