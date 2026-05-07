import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import router from "./routes";

const app: Express = express();

// MIGRATION: HSTS preload + security headers for Railway production
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: false, // SPA + Socket.io 호환 — CSP 별도 정책 필요
}));

// MIGRATION: 다중 origin 지원 — Vercel 다중 도메인 및 로컬 개발 대응
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS ?? "";
const allowedOrigins = rawAllowedOrigins
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  // MIGRATION: Replit-specific behavior preserved via env guard — open CORS in Replit dev
  origin: process.env.REPL_ID || allowedOrigins.length === 0
    ? true
    : (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
  credentials: true,
}));

// MIGRATION: 라우트별 레이트 리밋 — Railway 프로덕션 DDoS 방어
// 인증: 강한 제한 (brute-force 방어)
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));
// POS/주문: 영업 피크 시 분당 트래픽 폭증 → 느슨하게
app.use("/api/orders", rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
// 투자자: 감사 로그 + 강한 제한 (PDF export 오남용 방지)
app.use("/api/investor", rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded hostess photos
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use("/api", router);

export default app;
