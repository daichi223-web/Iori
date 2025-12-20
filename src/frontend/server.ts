/**
 * Iori v3.0 Frontend Server
 * Apple-inspired Dashboard Backend
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// CORS設定
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// 静的ファイル配信 (public ディレクトリ)
app.use(express.static(path.join(__dirname, "public")));

// API: システムログ取得
app.get("/api/logs", async (_req, res) => {
  try {
    const logPath = path.join(projectRoot, "iori_system.log");
    const content = await fs.readFile(logPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    res.json({
      file: "iori_system.log",
      content,
      lines,
      count: lines.length
    });
  } catch (error) {
    res.json({
      file: "iori_system.log",
      content: "",
      lines: [],
      count: 0,
      error: "Log file not found"
    });
  }
});

// API: TODO取得
app.get("/api/todos", async (_req, res) => {
  try {
    const todoPath = path.join(projectRoot, "TODO.md");
    const content = await fs.readFile(todoPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    res.json({
      file: "TODO.md",
      content,
      lines,
      count: lines.length
    });
  } catch (error) {
    res.json({
      file: "TODO.md",
      content: "",
      lines: [],
      count: 0,
      error: "TODO file not found"
    });
  }
});

// API: システムステータス
app.get("/api/status", (_req, res) => {
  res.json({
    version: "3.0.0",
    status: "online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🌐 Iori Dashboard Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Status: Online\n`);
});

export { app };
