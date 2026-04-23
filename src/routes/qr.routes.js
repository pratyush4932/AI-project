import express from 'express';
import { generateQRToken, accessQRToken } from '../controllers/qr.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route POST /qr/generate
 * @desc Generate a secure, time-limited QR token mapped to explicit records
 * @access Private/Patient (Requires valid JWT)
 */
router.post('/generate', authMiddleware, generateQRToken);

/**
 * @route GET /qr/:token
 * @desc Dynamically fetch records bound to the UUIDv4 token
 * @access Public (Token acts as auth inherently)
 */
router.get('/:token', accessQRToken);

export default router;
