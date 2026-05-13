import express from "express";
import { 
  getAvailableDoctors, 
  requestAppointment, 
  getPatientAppointments, 
  getHospitalAppointments, 
  updateAppointmentStatus 
} from "../controllers/appointment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Patient endpoints (also accessible by any authenticated user for getting doctors)
router.get("/doctors", authMiddleware, getAvailableDoctors);
router.post("/request", authMiddleware, requestAppointment);
router.get("/patient", authMiddleware, getPatientAppointments);

// Hospital endpoints
router.get("/hospital", authMiddleware, getHospitalAppointments);
router.patch("/hospital/:id/status", authMiddleware, updateAppointmentStatus);

export default router;
