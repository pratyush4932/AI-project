import 'dotenv/config';
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import recordRoutes from "./routes/record.routes.js";
import hospitalRoutes from "./routes/hospital.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import folderRoutes from "./routes/folder.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/records", recordRoutes);
app.use("/hospital", hospitalRoutes);
app.use("/doctor", doctorRoutes);
app.use("/folders", folderRoutes);
app.use("/ai", aiRoutes);

app.use(errorHandler);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});