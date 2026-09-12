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

router.get("/integrations/casting/applications", requireBotApiKey, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const after = parseAfter(req.query.after);

    const applications = await prisma.castingApplication.findMany({
      where: after ? { submittedAt: { gt: after } } : undefined,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        classification: true,
        submittedAt: true,
        answers: true,
        user: {
          select: {
            discordId: true,
            username: true,
            globalName: true,
            avatar: true,
            robloxId: true,
            robloxUsername: true,
            robloxDisplayName: true,
            robloxAvatar: true,
          },
        },
      },
    });

    const nextAfter = applications.length
      ? applications[applications.length - 1].submittedAt.toISOString()
      : (after?.toISOString() || null);

    return res.json({
      applications,
      nextAfter,
      hasMore: applications.length === limit,
    });
  } catch (error) {
    console.error("casting bot API error:", error);
    return res.status(500).json({ error: "Could not load casting applications." });
  }
});

export default router;
