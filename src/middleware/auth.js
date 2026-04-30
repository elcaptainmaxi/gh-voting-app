import prisma from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: "No autenticado." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Sesión inválida." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("requireAuth error:", error);
    return res.status(500).json({ error: "Error validando la sesión." });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado." });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "No autorizado." });
  }

  next();
}