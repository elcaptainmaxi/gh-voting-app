import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { adminLimiter } from "../middleware/rateLimiters.js";

const router = Router();

const QUESTION_KEYS = Array.from({ length: 30 }, (_, index) => `q${index + 1}`);
const EDITABLE_QUESTION_KEYS = QUESTION_KEYS.filter((key) => !["q5", "q6"].includes(key));
const LONG_QUESTION_KEYS = QUESTION_KEYS.filter((key) => Number(key.slice(1)) >= 7);
const IMPORTANT_QUESTION_KEYS = new Set(["q8", "q16", "q17", "q18", "q21", "q26", "q27", "q29", "q30"]);
const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);
const VALID_CLASSIFICATIONS = new Set(["NONE", "FAVORITE", "REVIEW_AGAIN"]);

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("casting route error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Ocurrió un error procesando el casting." });
      }
    }
  };
}

function cleanText(value, maxLength = 6000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function countWords(value) {
  return cleanText(value)
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function startsWithUppercase(value) {
  const first = Array.from(cleanText(value))[0] || "";
  return /\p{Lu}/u.test(first);
}

function answerRequirement(key) {
  return IMPORTANT_QUESTION_KEYS.has(key)
    ? { minChars: 120, minWords: 20 }
    : { minChars: 80, minWords: 15 };
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
  const issues = {};

  for (const key of QUESTION_KEYS) {
    if (!answers[key]) issues[key] = "Esta pregunta es obligatoria.";
  }

  for (const key of ["q1", "q2"]) {
    const value = answers[key] || "";
    if (value && value.length < 2) {
      issues[key] = "Debe tener al menos 2 caracteres.";
    } else if (value && !startsWithUppercase(value)) {
      issues[key] = "La primera letra debe estar en mayúscula.";
    }
  }

  const ageRaw = answers.q3 || "";
  if (ageRaw && (!/^\d{2}$/.test(ageRaw) || Number(ageRaw) < 13 || Number(ageRaw) > 99)) {
    issues.q3 = "La edad debe ser un número entero entre 13 y 99.";
  }

  if (answers.q4 && answers.q4.length < 2) {
    issues.q4 = "Ingresá un país válido.";
  }

  for (const key of LONG_QUESTION_KEYS) {
    const value = answers[key] || "";
    if (!value) continue;
    const { minChars, minWords } = answerRequirement(key);
    const words = countWords(value);
    if (value.length < minChars || words < minWords) {
      issues[key] = `La respuesta debe tener al menos ${minChars} caracteres y ${minWords} palabras.`;
    }
  }

  const invalidKeys = Object.keys(issues);
  return {
    ok: invalidKeys.length === 0,
    invalidKeys,
    issues,
    error: invalidKeys.length ? "Revisá las respuestas marcadas antes de enviar la postulación." : null,
  };
}

function reviewerIdentity(user) {
  return {
    userId: user.id,
    name: user.globalName || user.username,
  };
}

router.get("/casting/me", requireAuth, asyncRoute(async (req, res) => {
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
    validation: {
      normal: { minChars: 80, minWords: 15 },
      important: { minChars: 120, minWords: 20 },
      importantQuestions: Array.from(IMPORTANT_QUESTION_KEYS),
    },
  });
}));

router.post("/casting/applications", requireAuth, requireCsrf, asyncRoute(async (req, res) => {
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
      invalidKeys: ["q6"],
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
    throw error;
  }
}));

router.use("/admin/casting", requireAuth, requireAdmin, adminLimiter);

router.get("/admin/casting/applications", asyncRoute(async (req, res) => {
  const status = cleanText(req.query.status, 20).toUpperCase();
  const classification = cleanText(req.query.classification, 30).toUpperCase();
  const search = cleanText(req.query.search, 120);
  const sort = req.query.sort === "asc" ? "asc" : "desc";

  const where = {
    ...(VALID_STATUSES.has(status) ? { status } : {}),
    ...(VALID_CLASSIFICATIONS.has(classification) ? { classification } : {}),
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

  const [applications, total, pending, approved, rejected] = await prisma.$transaction([
    prisma.castingApplication.findMany({
      where,
      orderBy: { submittedAt: sort },
      select: {
        id: true,
        status: true,
        classification: true,
        submittedAt: true,
        reviewedAt: true,
        lastReviewedByName: true,
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
    }),
    prisma.castingApplication.count(),
    prisma.castingApplication.count({ where: { status: "PENDING" } }),
    prisma.castingApplication.count({ where: { status: "APPROVED" } }),
    prisma.castingApplication.count({ where: { status: "REJECTED" } }),
  ]);

  let rows = applications.map((application) => ({
    id: application.id,
    status: application.status,
    classification: application.classification,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    lastReviewedByName: application.lastReviewedByName,
    updatedAt: application.updatedAt,
    applicant: {
      roleroName: application.answers?.q1 || "",
      roleroSurname: application.answers?.q2 || "",
      age: application.answers?.q3 || "",
      country: application.answers?.q4 || "",
    },
    user: application.user,
  }));

  if (search) {
    const needle = search.toLocaleLowerCase("es");
    rows = rows.filter((row) => {
      const applicant = `${row.applicant.roleroName} ${row.applicant.roleroSurname}`.toLocaleLowerCase("es");
      const externalMatches = [
        row.user.username,
        row.user.globalName,
        row.user.discordId,
        row.user.robloxUsername,
        row.user.robloxDisplayName,
        row.user.robloxId,
      ].some((value) => String(value || "").toLocaleLowerCase("es").includes(needle));
      return applicant.includes(needle) || externalMatches;
    });
  }

  return res.json({
    applications: rows,
    metrics: { total, pending, approved, rejected },
  });
}));

router.get("/admin/casting/applications/:applicationId", asyncRoute(async (req, res) => {
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
      reviewEvents: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!application) {
    return res.status(404).json({ error: "La postulación no existe." });
  }

  return res.json({ application });
}));

router.patch("/admin/casting/applications/:applicationId", requireCsrf, asyncRoute(async (req, res) => {
  const { applicationId } = req.params;
  const requestedStatus = cleanText(req.body?.status, 20).toUpperCase();
  const requestedClassification = cleanText(req.body?.classification, 30).toUpperCase();
  const hasStatus = req.body?.status !== undefined;
  const hasClassification = req.body?.classification !== undefined;
  const hasNotes = req.body?.internalNotes !== undefined;

  if (hasStatus && !VALID_STATUSES.has(requestedStatus)) {
    return res.status(400).json({ error: "Estado de casting inválido." });
  }

  if (hasClassification && !VALID_CLASSIFICATIONS.has(requestedClassification)) {
    return res.status(400).json({ error: "Clasificación interna inválida." });
  }

  if (!hasStatus && !hasClassification && !hasNotes) {
    return res.status(400).json({ error: "No hay cambios para guardar." });
  }

  const existing = await prisma.castingApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, classification: true, internalNotes: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "La postulación no existe." });
  }

  const reviewer = reviewerIdentity(req.user);
  const statusChanged = hasStatus && requestedStatus !== existing.status;
  const classificationChanged = hasClassification && requestedClassification !== existing.classification;
  const notesValue = hasNotes ? cleanText(req.body.internalNotes, 12000) : existing.internalNotes;
  const notesChanged = hasNotes && notesValue !== existing.internalNotes;
  const changed = statusChanged || classificationChanged || notesChanged;

  const events = [];
  if (statusChanged) {
    events.push({
      applicationId,
      reviewerUserId: reviewer.userId,
      reviewerName: reviewer.name,
      action: "STATUS_CHANGED",
      fromValue: existing.status,
      toValue: requestedStatus,
    });
  }
  if (classificationChanged) {
    events.push({
      applicationId,
      reviewerUserId: reviewer.userId,
      reviewerName: reviewer.name,
      action: "CLASSIFICATION_CHANGED",
      fromValue: existing.classification,
      toValue: requestedClassification,
    });
  }
  if (notesChanged) {
    events.push({
      applicationId,
      reviewerUserId: reviewer.userId,
      reviewerName: reviewer.name,
      action: "NOTES_UPDATED",
      fromValue: null,
      toValue: null,
    });
  }

  const application = await prisma.$transaction(async (tx) => {
    const updated = await tx.castingApplication.update({
      where: { id: applicationId },
      data: {
        ...(hasStatus ? { status: requestedStatus } : {}),
        ...(hasClassification ? { classification: requestedClassification } : {}),
        ...(hasNotes ? { internalNotes: notesValue } : {}),
        ...(changed
          ? {
              reviewedAt: new Date(),
              lastReviewedByUserId: reviewer.userId,
              lastReviewedByName: reviewer.name,
            }
          : {}),
      },
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

    if (events.length) {
      await tx.castingReviewEvent.createMany({ data: events });
    }

    return updated;
  });

  return res.json({ application });
}));

router.delete("/admin/casting/applications/:applicationId", requireCsrf, asyncRoute(async (req, res) => {
  const existing = await prisma.castingApplication.findUnique({
    where: { id: req.params.applicationId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "La postulación no existe." });
  }

  await prisma.castingApplication.delete({ where: { id: existing.id } });
  console.warn(`Casting ${existing.id} eliminado por ${req.user.globalName || req.user.username} (${req.user.discordId}).`);
  return res.json({ success: true });
}));

router.delete("/admin/casting/applications", requireCsrf, asyncRoute(async (req, res) => {
  if (req.body?.confirmation !== "ELIMINAR TODAS") {
    return res.status(400).json({ error: "Confirmación inválida. Escribí ELIMINAR TODAS." });
  }

  const result = await prisma.castingApplication.deleteMany({});
  console.warn(`${result.count} castings eliminados por ${req.user.globalName || req.user.username} (${req.user.discordId}).`);
  return res.json({ success: true, deletedCount: result.count });
}));

export default router;
