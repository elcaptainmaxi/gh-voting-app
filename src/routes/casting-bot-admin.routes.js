import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { adminLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.use("/admin/casting", requireAuth, requireAdmin, adminLimiter);

router.post("/admin/casting/applications/:applicationId/send-to-bot", requireCsrf, async (req, res) => {
  try {
    const application = await prisma.castingApplication.findUnique({
      where: { id: req.params.applicationId },
      select: { id: true },
    });

    if (!application) {
      return res.status(404).json({ error: "La postulación no existe." });
    }

    const queuedBy = `${req.user.globalName || req.user.username} (${req.user.discordId})`;
    const event = await prisma.castingBotQueueEvent.create({
      data: {
        applicationId: application.id,
        queuedBy,
      },
      select: {
        id: true,
        queuedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Postulación enviada a la cola del bot.",
      event,
    });
  } catch (error) {
    console.error("casting bot queue admin error:", error);
    return res.status(500).json({ error: "No se pudo enviar la postulación al bot." });
  }
});

export default router;
