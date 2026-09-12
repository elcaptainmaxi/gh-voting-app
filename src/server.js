import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import apiRoutes from "./routes/api.routes.js";
import castingRoutes from "./routes/casting.routes.js";
import { env, isProduction } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimiters.js";
import { requireAuth } from "./middleware/auth.js";

const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PgStore = connectPgSimple(session);

const pgPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProduction
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

// Necesario en Railway para cookies secure detrás del proxy.
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": [
          "'self'",
          "data:",
          "https://cdn.discordapp.com",
          "https://media.discordapp.net",
          "https://images.unsplash.com",
          "https:",
        ],
        "script-src": [
          "'self'",
          "https://challenges.cloudflare.com",
        ],
        "frame-src": [
          "'self'",
          "https://challenges.cloudflare.com",
        ],
        "connect-src": [
          "'self'",
          "https://challenges.cloudflare.com",
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.use(compression());
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(globalLimiter);

app.use(
  session({
    name: "sid",
    store: new PgStore({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/api", castingRoutes);

function requireAdminPage(req, res, next) {
  if (!req.session?.userId) {
    return res.redirect("/auth/login?returnTo=%2Fadmin%2Fcasting");
  }

  return requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.redirect("/");
    }
    next();
  });
}

// El HTML de Producción también se protege en servidor, antes de express.static.
app.get("/admin/casting", requireAdminPage, (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin-casting.html"));
});

app.get("/admin-casting.html", requireAdminPage, (_req, res) => {
  res.redirect("/admin/casting");
});

app.get("/admin/casting.html", requireAdminPage, (_req, res) => {
  res.redirect("/admin/casting");
});

// Verificación de dominio solicitada por Discord.
app.get("/.well-known/discord", (_req, res) => {
  res.type("text/plain").send("dh=c985e5bf0ab384a2cadac06bec465650fc319944");
});

// Archivos estáticos: CSS, JS, assets, imágenes.
app.use(express.static(path.join(__dirname, "../public")));

// Redirects para no usar .html.
app.get("/vote.html", (_req, res) => {
  res.redirect("/vote");
});

app.get("/admin.html", (_req, res) => {
  res.redirect("/admin");
});

app.get("/casting.html", (_req, res) => {
  res.redirect("/casting");
});

// Rutas limpias.
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "/vote"));
});

app.get("/vote", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/vote.html"));
});

app.get("/casting", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/casting.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/uploads", express.static(uploadsDir));

// Fallback final.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(env.PORT, () => {
  console.log(`Servidor listo en ${env.APP_URL}`);
});
