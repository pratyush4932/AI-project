import 'dotenv/config';
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import recordRoutes from "./routes/record.routes.js";
import hospitalRoutes from "./routes/hospital.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import folderRoutes from "./routes/folder.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import cors from "cors";
import { errorHandler } from "./middleware/error.middleware.js";

// Initialize workers
import './workers/aiWorker.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/records", recordRoutes);
app.use("/hospital", hospitalRoutes);
app.use("/doctor", doctorRoutes);
app.use("/folders", folderRoutes);
app.use("/ai", aiRoutes);
app.use("/qr", qrRoutes);

// Health Check Route
app.get("/status", (req, res) => {
  res.json({
    status: "active",
    message: "Medora API is running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

app.use(errorHandler);
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;