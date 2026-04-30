import rateLimit from "express-rate-limit";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

export const globalLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 2000),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos.",
  },
});

export const authLimiter = rateLimit({
  windowMs,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de inicio de sesión. Espera un poco.",
  },
});

export const voteLimiter = rateLimit({
  windowMs,
  max: Number(process.env.VOTE_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de voto. Espera unos minutos.",
  },
});

export const adminLimiter = rateLimit({
  windowMs,
  max: Number(process.env.ADMIN_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes administrativas. Espera un momento.",
  },
});