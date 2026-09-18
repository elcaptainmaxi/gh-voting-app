import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import pg from "pg";
import path from "path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import apiRoutes from "./routes/api.routes.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { env, isProduction } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimiters.js";

const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "data:", "https://cdn.discordapp.com", "https://media.discordapp.net", "https://images.unsplash.com", "https:"],
      "script-src": ["'self'", "https://challenges.cloudflare.com"],
      "frame-src": ["'self'", "https://challenges.cloudflare.com"],
      "connect-src": ["'self'", "https://challenges.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(compression());
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(globalLimiter);
app.use(session({
  name: "sid",
  store: new PgStore({ pool: pgPool, tableName: "session", createTableIfMissing: true }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: { httpOnly: true, secure: isProduction, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
}));
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);

// Proteger el HTML de producción antes de registrar los archivos estáticos.
app.get(["/conteo-tiktok", "/conteo-tiktok.html"], requireAuth, requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/conteo-tiktok.html"));
});
app.use(express.static(path.join(__dirname, "../public")));

app.get("/vote.html", (_req, res) => res.redirect("/vote"));
app.get("/admin.html", (_req, res) => res.redirect("/admin"));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "/vote")));
app.get("/vote", (_req, res) => res.sendFile(path.join(__dirname, "../public/vote.html")));

// Mantener el panel existente intacto y sumar un acceso visible a la nueva sección.
app.get("/admin", async (_req, res, next) => {
  try {
    const html = await readFile(path.join(__dirname, "../public/admin.html"), "utf8");
    const link = '<a class="admin-nav-btn" href="/conteo-tiktok" style="display:block;text-decoration:none">Conteo TikTok</a>';
    res.type("html").send(html.replace('</aside>', `${link}\n    </aside>`));
  } catch (error) { next(error); }
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/uploads", express.static(uploadsDir));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));
app.listen(env.PORT, () => console.log(`Servidor listo en ${env.APP_URL}`));