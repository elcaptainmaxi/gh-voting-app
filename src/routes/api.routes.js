import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { voteLimiter, adminLimiter } from "../middleware/rateLimiters.js";
import { getClientIp, hashIp } from "../lib/security.js";

const router = Router();

function serializeUser(user, csrfToken) {
  return {
    user: {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
    },
    csrfToken,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  return res.json(serializeUser(req.user, req.session.csrfToken));
});

router.get("/active-plate", requireAuth, async (_req, res) => {
  let plate = await prisma.plate.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      nominees: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          displayName: true,
          imageUrl: true,
          createdAt: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!plate) {
    plate = await prisma.plate.findFirst({
      where: { status: "PAUSED" },
      orderBy: { createdAt: "desc" },
      include: {
        nominees: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            displayName: true,
            imageUrl: true,
            createdAt: true,
            sortOrder: true,
          },
        },
      },
    });
  }

  return res.json({ plate });
});

router.get("/my-vote-status", requireAuth, async (req, res) => {
  const activePlate = await prisma.plate.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (!activePlate) {
    return res.json({
      hasVoted: false,
      plateId: null,
    });
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      plateId_userId: {
        plateId: activePlate.id,
        userId: req.user.id,
      },
    },
    select: { id: true },
  });

  return res.json({
    hasVoted: Boolean(existingVote),
    plateId: activePlate.id,
  });
});

router.post("/vote", requireAuth, requireCsrf, voteLimiter, async (req, res) => {
  const { nomineeId } = req.body || {};

  if (!nomineeId || typeof nomineeId !== "string") {
    return res.status(400).json({ error: "Falta el nominado." });
  }

  const activePlate = await prisma.plate.findFirst({
    where: { status: "ACTIVE" },
    include: {
      nominees: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!activePlate) {
    return res.status(400).json({ error: "No hay una placa activa para votar." });
  }

  const nomineeExists = activePlate.nominees.some((nominee) => nominee.id === nomineeId);
  if (!nomineeExists) {
    return res.status(400).json({ error: "El nominado no pertenece a la placa activa." });
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      plateId_userId: {
        plateId: activePlate.id,
        userId: req.user.id,
      },
    },
  });

  if (existingVote) {
    return res.status(409).json({ error: "Ya votaste en esta placa." });
  }

  const clientIp = getClientIp(req);
  const voterIpHash = hashIp(clientIp);

  const ipVoteCount = await prisma.vote.count({
    where: {
      plateId: activePlate.id,
      voterIpHash,
    },
  });

  if (ipVoteCount >= activePlate.maxVotesPerIp) {
    return res.status(429).json({
      error: "Se alcanzó el máximo de votos permitidos para esta IP en la placa activa.",
    });
  }

  try {
    const vote = await prisma.vote.create({
      data: {
        plateId: activePlate.id,
        nomineeId,
        userId: req.user.id,
        voterIpHash,
      },
    });

    return res.status(201).json({
      success: true,
      voteId: vote.id,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya votaste en esta placa." });
    }

    console.error(error);
    return res.status(500).json({ error: "No se pudo registrar el voto." });
  }
});

router.use("/admin", requireAuth, requireAdmin, adminLimiter);

/* =========================
   PLACAS
========================= */

router.get("/admin/plates", async (_req, res) => {
  const plates = await prisma.plate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      nominees: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          displayName: true,
          imageUrl: true,
          createdAt: true,
          sortOrder: true,
        },
      },
    },
  });

  return res.json({ plates });
});

router.post("/admin/plates", requireCsrf, async (req, res) => {
  const { title, description, maxVotesPerIp, status } = req.body || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "El título es obligatorio." });
  }

  const normalizedStatus = ["DRAFT", "ACTIVE", "PAUSED", "FINISHED"].includes(status)
    ? status
    : "DRAFT";

  if (normalizedStatus === "ACTIVE") {
    await prisma.plate.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
  }

  const plate = await prisma.plate.create({
    data: {
      title: title.trim(),
      description: String(description || "").trim(),
      maxVotesPerIp: Number(maxVotesPerIp) > 0 ? Number(maxVotesPerIp) : 2,
      status: normalizedStatus,
    },
  });

  return res.status(201).json({ plate });
});

router.patch("/admin/plates/:plateId", requireCsrf, async (req, res) => {
  const { plateId } = req.params;
  const { title, description, maxVotesPerIp, status } = req.body || {};

  const existingPlate = await prisma.plate.findUnique({
    where: { id: plateId },
    select: { id: true },
  });

  if (!existingPlate) {
    return res.status(404).json({ error: "La placa no existe." });
  }

  const normalizedStatus = ["DRAFT", "ACTIVE", "PAUSED", "FINISHED"].includes(status)
    ? status
    : undefined;

  if (normalizedStatus === "ACTIVE") {
    await prisma.plate.updateMany({
      where: {
        status: "ACTIVE",
        NOT: { id: plateId },
      },
      data: { status: "PAUSED" },
    });
  }

  const plate = await prisma.plate.update({
    where: { id: plateId },
    data: {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(maxVotesPerIp !== undefined
        ? { maxVotesPerIp: Math.max(1, Number(maxVotesPerIp) || 1) }
        : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
    },
  });

  return res.json({ plate });
});

router.delete("/admin/plates/:plateId", requireCsrf, async (req, res) => {
  const { plateId } = req.params;

  const plate = await prisma.plate.findUnique({
    where: { id: plateId },
    select: { id: true },
  });

  if (!plate) {
    return res.status(404).json({ error: "La placa no existe." });
  }

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { plateId } }),
    prisma.nominee.deleteMany({ where: { plateId } }),
    prisma.plate.delete({ where: { id: plateId } }),
  ]);

  return res.json({ success: true });
});

router.patch("/admin/plates/:plateId/status", requireCsrf, async (req, res) => {
  const { plateId } = req.params;
  const { status } = req.body || {};

  if (!["DRAFT", "ACTIVE", "PAUSED", "FINISHED"].includes(status)) {
    return res.status(400).json({ error: "Estado inválido." });
  }

  if (status === "ACTIVE") {
    await prisma.plate.updateMany({
      where: {
        status: "ACTIVE",
        NOT: { id: plateId },
      },
      data: { status: "PAUSED" },
    });
  }

  const plate = await prisma.plate.update({
    where: { id: plateId },
    data: { status },
  });

  return res.json({ plate });
});

/* =========================
   NOMINADOS
========================= */

router.post("/admin/plates/:plateId/nominees", requireCsrf, async (req, res) => {
  const { plateId } = req.params;
  const { name, displayName, imageUrl, sortOrder } = req.body || {};

  const finalDisplayName =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : typeof name === "string" && name.trim()
      ? name.trim()
      : "";

  if (!finalDisplayName) {
    return res.status(400).json({ error: "El nombre del nominado es obligatorio." });
  }

  const plate = await prisma.plate.findUnique({
    where: { id: plateId },
    select: { id: true },
  });

  if (!plate) {
    return res.status(404).json({ error: "La placa no existe." });
  }

  let nextSortOrder = 0;

  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== "") {
    nextSortOrder = Number(sortOrder) || 0;
  } else {
    const lastNominee = await prisma.nominee.findFirst({
      where: { plateId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    nextSortOrder = lastNominee ? lastNominee.sortOrder + 1 : 0;
  }

  const nominee = await prisma.nominee.create({
    data: {
      plateId,
      displayName: finalDisplayName,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      sortOrder: nextSortOrder,
    },
  });

  return res.status(201).json({ nominee });
});

router.post("/admin/plates/:plateId/nominees/from-catalog", requireCsrf, async (req, res) => {
  const { plateId } = req.params;
  const { participantIds } = req.body || {};

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: "Seleccioná al menos un participante." });
  }

  const plate = await prisma.plate.findUnique({
    where: { id: plateId },
    select: { id: true },
  });

  if (!plate) {
    return res.status(404).json({ error: "La placa no existe." });
  }

  const participants = await prisma.participantCatalog.findMany({
    where: {
      id: { in: participantIds },
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!participants.length) {
    return res.status(400).json({ error: "No se encontraron participantes válidos." });
  }

  const existingNominees = await prisma.nominee.findMany({
    where: { plateId },
    select: { displayName: true, sortOrder: true },
    orderBy: { sortOrder: "desc" },
  });

  let currentSort = existingNominees.length ? existingNominees[0].sortOrder + 1 : 0;
  const existingNames = new Set(existingNominees.map((n) => n.displayName.toLowerCase()));

  const toCreate = participants
    .filter((p) => !existingNames.has(p.displayName.toLowerCase()))
    .map((p) => ({
      plateId,
      displayName: p.displayName,
      imageUrl: p.imageUrl || null,
      sortOrder: currentSort++,
    }));

  if (!toCreate.length) {
    return res.status(409).json({ error: "Esos participantes ya están cargados en la placa." });
  }

  await prisma.nominee.createMany({
    data: toCreate,
  });

  return res.json({ success: true, created: toCreate.length });
});

router.patch("/admin/plates/:plateId/nominees/reorder", requireCsrf, async (req, res) => {
  const { plateId } = req.params;
  const { orderedIds } = req.body || {};

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: "Falta el nuevo orden." });
  }

  const nominees = await prisma.nominee.findMany({
    where: { plateId },
    select: { id: true },
  });

  const validIds = new Set(nominees.map((n) => n.id));
  const allValid = orderedIds.every((id) => validIds.has(id));

  if (!allValid || orderedIds.length !== nominees.length) {
    return res.status(400).json({ error: "El orden enviado no es válido." });
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.nominee.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return res.json({ success: true });
});

router.delete("/admin/plates/:plateId/nominees/:nomineeId", requireCsrf, async (req, res) => {
  const { plateId, nomineeId } = req.params;

  const nominee = await prisma.nominee.findFirst({
    where: {
      id: nomineeId,
      plateId,
    },
    select: {
      id: true,
      _count: {
        select: { votes: true },
      },
    },
  });

  if (!nominee) {
    return res.status(404).json({ error: "El nominado no existe en esa placa." });
  }

  if (nominee._count.votes > 0) {
    return res.status(409).json({
      error: "No se puede eliminar un nominado que ya tiene votos registrados.",
    });
  }

  await prisma.nominee.delete({
    where: { id: nomineeId },
  });

  return res.json({ success: true });
});

/* =========================
   RESULTADOS
========================= */

router.get("/admin/plates/:plateId/results", async (req, res) => {
  const { plateId } = req.params;

  const plate = await prisma.plate.findUnique({
    where: { id: plateId },
    include: {
      nominees: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: {
            select: { votes: true },
          },
        },
      },
    },
  });

  if (!plate) {
    return res.status(404).json({ error: "La placa no existe." });
  }

  const results = plate.nominees
    .map((nominee) => ({
      id: nominee.id,
      displayName: nominee.displayName,
      votes: nominee._count.votes,
    }))
    .sort((a, b) => b.votes - a.votes);

  return res.json({
    plate: {
      id: plate.id,
      title: plate.title,
      status: plate.status,
    },
    results,
  });
});

/* =========================
   CATÁLOGO
========================= */

router.get("/admin/catalog", async (_req, res) => {
  const participants = await prisma.participantCatalog.findMany({
    orderBy: { displayName: "asc" },
  });

  return res.json({ participants });
});

router.post("/admin/catalog", requireCsrf, async (req, res) => {
  const { displayName, imageUrl, isActive } = req.body || {};

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return res.status(400).json({ error: "El nombre del participante es obligatorio." });
  }

  const participant = await prisma.participantCatalog.create({
    data: {
      displayName: displayName.trim(),
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      isActive: isActive !== false,
    },
  });

  return res.status(201).json({ participant });
});

router.patch("/admin/catalog/:participantId", requireCsrf, async (req, res) => {
  const { participantId } = req.params;
  const { displayName, imageUrl, isActive } = req.body || {};

  const participant = await prisma.participantCatalog.update({
    where: { id: participantId },
    data: {
      ...(displayName !== undefined ? { displayName: String(displayName).trim() } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });

  return res.json({ participant });
});

router.delete("/admin/catalog/:participantId", requireCsrf, async (req, res) => {
  const { participantId } = req.params;

  await prisma.participantCatalog.delete({
    where: { id: participantId },
  });

  return res.json({ success: true });
});

export default router;