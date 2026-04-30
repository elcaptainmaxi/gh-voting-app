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
import { env, isProduction } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimiters.js";

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
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'"],
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

// Archivos estáticos: CSS, JS, assets, imágenes.
app.use(express.static(path.join(__dirname, "../public")));

// Redirects para no usar .html.
app.get("/vote.html", (_req, res) => {
  res.redirect("/vote");
});

app.get("/admin.html", (_req, res) => {
  res.redirect("/admin");
});

// Rutas limpias.
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "/vote"));
});

app.get("/vote", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/vote.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Fallback final.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(env.PORT, () => {
  console.log(`Servidor listo en ${env.APP_URL}`);
});