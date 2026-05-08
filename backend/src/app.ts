import express from "express";
import helmet from "helmet";
import cors from "cors";
import { githubRouter } from "./routes/github.routes.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",");

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin "${origin}" not allowed by CORS policy.`));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "X-GitHub-Token"],
    exposedHeaders: [],
  })
);

app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/github", githubRouter);
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Server started",
      port: PORT,
      env: process.env.NODE_ENV ?? "development",
    })
  );
});

export default app;
