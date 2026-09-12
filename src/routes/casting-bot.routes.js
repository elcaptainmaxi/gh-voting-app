import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

function requireBotApiKey(req, res, next) {
  const configuredKey = process.env.CASTING_BOT_API_KEY;

  if (!configuredKey) {
    return res.status(503).json({ error: "Casting bot integration is not configured." });
  }

  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || token !== configuredKey) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
}

function parseLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseAfter(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

const userSelect = {
  discordId: true,
  username: true,
  globalName: true,
  robloxId: true,
  robloxUsername: true,
  robloxDisplayName: true,
};

function serializeApplication(application) {
  return {
    id: application.id,
    status: application.status,
    submittedAt: application.submittedAt,
    user: application.user,
  };
}

router.get("/integrations/casting/applications", requireBotApiKey, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const after = parseAfter(req.query.after);

    const [newApplications, queuedEvents] = await Promise.all([
      prisma.castingApplication.findMany({
        where: after ? { submittedAt: { gt: after } } : undefined,
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        take: limit,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          user: { select: userSelect },
        },
      }),
      prisma.castingBotQueueEvent.findMany({
        where: after ? { queuedAt: { gt: after } } : undefined,
        orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
        take: limit,
        select: {
          id: true,
          queuedAt: true,
          application: {
            select: {
              id: true,
              status: true,
              submittedAt: true,
              user: { select: userSelect },
            },
          },
        },
      }),
    ]);

    const deliveries = [
      ...newApplications.map((application) => ({
        deliveryAt: application.submittedAt,
        stableId: `application:${application.id}`,
        application,
      })),
      ...queuedEvents.map((event) => ({
        deliveryAt: event.queuedAt,
        stableId: `queue:${event.id}`,
        application: event.application,
      })),
    ]
      .sort((a, b) => {
        const timeDiff = a.deliveryAt.getTime() - b.deliveryAt.getTime();
        return timeDiff || a.stableId.localeCompare(b.stableId);
      })
      .slice(0, limit);

    const applications = deliveries.map(({ application }) => serializeApplication(application));
    const nextAfter = deliveries.length
      ? deliveries[deliveries.length - 1].deliveryAt.toISOString()
      : (after?.toISOString() || null);

    return res.json({
      applications,
      nextAfter,
      hasMore: newApplications.length === limit || queuedEvents.length === limit || deliveries.length === limit,
    });
  } catch (error) {
    console.error("casting bot API error:", error);
    return res.status(500).json({ error: "Could not load casting applications." });
  }
});

export default router;
