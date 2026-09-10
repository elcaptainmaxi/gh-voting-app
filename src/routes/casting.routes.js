import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { adminLimiter } from "../middleware/rateLimiters.js";

const router = Router();

const QUESTION_KEYS = Array.from({ length: 30 }, (_, index) => `q${index + 1}`);
const EDITABLE_QUESTION_KEYS = QUESTION_KEYS.filter((key) => !["q5", "q6"].includes(key));
const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

function cleanText(value, maxLength = 6000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function publicUserIdentity(user) {
  return {
    discord: {
      id: user.discordId,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
    },
    roblox: user.robloxId
      ? {
          id: user.robloxId,
          username: user.robloxUsername,
          displayName: user.robloxDisplayName,
          avatar: user.robloxAvatar,
        }
      : null,
  };
}

function buildAnswers(rawAnswers, user) {
  const answers = {};

  for (const key of EDITABLE_QUESTION_KEYS) {
    answers[key] = cleanText(rawAnswers?.[key]);
  }

  answers.q5 = `Discord vinculado: ${user.globalName || user.username} (@${user.username}) · ID ${user.discordId}`;
  answers.q6 = user.robloxId
    ? `Roblox vinculado: ${user.robloxDisplayName || user.robloxUsername} (@${user.robloxUsername}) · ID ${user.robloxId}`
    : "";

  return answers;
}

function validateAnswers(answers) {
  const missing = QUESTION_KEYS.filter((key) => !answers[key]);

  if (missing.length) {
    return {
      ok: false,
      missing,
      error: "Completá todas las preguntas antes de enviar la postulación.",
    };
  }

  const age = Number.parseInt(answers.q3, 10);
  if (!Number.isInteger(age) || age < 13 || age > 99) {
    return {
      ok: false,
      missing: ["q3"],
      error: "Ingresá una edad válida.",
    };
  }

  return { ok: true, missing: [] };
}

router.get("/casting/me", requireAuth, async (req, res) => {
  const application = await prisma.castingApplication.findUnique({
    where: { userId: req.user.id },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
    },
  });

  return res.json({
    identity: publicUserIdentity(req.user),
    application,
    csrfToken: req.session.csrfToken,
  });
});

router.post("/casting/applications", requireAuth, requireCsrf, async (req, res) => {
  const existing = await prisma.castingApplication.findUnique({
    where: { userId: req.user.id },
    select: { id: true, status: true, submittedAt: true },
  });

  if (existing) {
    return res.status(409).json({
      error: "Ya enviaste una postulación para El Laboratorio.",
      application: existing,
    });
  }

  if (!req.user.robloxId) {
    return res.status(400).json({
      error: "Tenés que vincular tu cuenta de Roblox antes de enviar la postulación.",
    });
  }

  const answers = buildAnswers(req.body?.answers || {}, req.user);
  const validation = validateAnswers(answers);

  if (!validation.ok) {
    return res.status(400).json(validation);
  }

  try {
    const application = await prisma.castingApplication.create({
      data: {
        userId: req.user.id,
        answers,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
      },
    });

    return res.status(201).json({ success: true, application });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Ya existe una postulación asociada a esta cuenta.",
      });
    }

    console.error("casting submission error:", error);
    return res.status(500).json({ error: "No se pudo enviar la postulación." });
  }
});

router.use("/admin/casting", requireAuth, requireAdmin, adminLimiter);

router.get("/admin/casting/applications", async (req, res) => {
  const status = cleanText(req.query.status, 20).toUpperCase();
  const search = cleanText(req.query.search, 120);

  const where = {
    ...(VALID_STATUSES.has(status) ? { status } : {}),
    ...(search
      ? {
          OR: [
            { user: { username: { contains: search, mode: "insensitive" } } },
            { user: { globalName: { contains: search, mode: "insensitive" } } },
            { user: { discordId: { contains: search } } },
            { user: { robloxUsername: { contains: search, mode: "insensitive" } } },
            { user: { robloxDisplayName: { contains: search, mode: "insensitive" } } },
            { user: { robloxId: { contains: search } } },
          ],
        }
      : {}),
  };

  const applications = await prisma.castingApplication.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      updatedAt: true,
      answers: true,
      user: {
        select: {
          id: true,
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

  const rows = applications.map((application) => ({
    id: application.id,
    status: application.status,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    updatedAt: application.updatedAt,
    applicant: {
      roleroName: application.answers?.q1 || "",
      roleroSurname: application.answers?.q2 || "",
      age: application.answers?.q3 || "",
      country: application.answers?.q4 || "",
    },
    user: application.user,
  }));

  return res.json({ applications: rows });
});

router.get("/admin/casting/applications/:applicationId", async (req, res) => {
  const application = await prisma.castingApplication.findUnique({
    where: { id: req.params.applicationId },
    include: {
      user: {
        select: {
          id: true,
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

  if (!application) {
    return res.status(404).json({ error: "La postulación no existe." });
  }

  return res.json({ application });
});

router.patch("/admin/casting/applications/:applicationId", requireCsrf, async (req, res) => {
  const { applicationId } = req.params;
  const requestedStatus = cleanText(req.body?.status, 20).toUpperCase();
  const hasStatus = req.body?.status !== undefined;
  const hasNotes = req.body?.internalNotes !== undefined;

  if (hasStatus && !VALID_STATUSES.has(requestedStatus)) {
    return res.status(400).json({ error: "Estado de casting inválido." });
  }

  if (!hasStatus && !hasNotes) {
    return res.status(400).json({ error: "No hay cambios para guardar." });
  }

  const existing = await prisma.castingApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "La postulación no existe." });
  }

  const statusChanged = hasStatus && requestedStatus !== existing.status;

  const application = await prisma.castingApplication.update({
    where: { id: applicationId },
    data: {
      ...(hasStatus ? { status: requestedStatus } : {}),
      ...(hasNotes ? { internalNotes: cleanText(req.body.internalNotes, 12000) } : {}),
      ...(statusChanged ? { reviewedAt: new Date() } : {}),
    },
    include: {
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

  return res.json({ application });
});

export default router;
