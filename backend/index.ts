import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRouter from "./routes/auth.js";
import storesRouter from "./routes/stores.js";
import itemsRouter from "./routes/items.js";
import pricesRouter from "./routes/prices.js";
import userStoresRouter from "./routes/userStores.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────
app.use(morgan("dev"));
app.use(cors({ origin: "http://localhost:5175", credentials: true }));
app.use(express.json());

// ─── Routes ──────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/stores", storesRouter);
app.use("/api/items", itemsRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/users/stores", userStoresRouter);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// 404 — must come after all routes
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found", status: 404 } });
});

// 500
app.use((err: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: "SERVER_ERROR", message: "Internal server error", status: 500 } });
});

// ─── Start ───────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
