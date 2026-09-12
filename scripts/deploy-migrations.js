import pg from "pg";
import { spawnSync } from "node:child_process";

const { Client } = pg;
const prismaCli = "./node_modules/prisma/build/index.js";
const initialMigration = "20260421034107_init";

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Prisma ${args.join(" ")} terminó con código ${result.status}.`);
  }
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS "exists"`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS "exists"`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function ensureCastingSchema(client) {
  if (!(await tableExists(client, "User"))) {
    throw new Error('No existe la tabla "User" después de aplicar migraciones.');
  }

  const robloxColumns = ["robloxId", "robloxUsername", "robloxDisplayName", "robloxAvatar"];
  for (const columnName of robloxColumns) {
    if (!(await columnExists(client, "User", columnName))) {
      console.warn(`Schema drift detectado: agregando User.${columnName}...`);
      await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "${columnName}" TEXT`);
    }
  }

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CastingStatus') THEN
        CREATE TYPE "CastingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CastingClassification') THEN
        CREATE TYPE "CastingClassification" AS ENUM ('NONE', 'FAVORITE', 'REVIEW_AGAIN');
      END IF;
    END
    $$;
  `);

  if (!(await tableExists(client, "CastingApplication"))) {
    console.warn('Schema drift detectado: creando tabla "CastingApplication"...');
    await client.query(`
      CREATE TABLE "CastingApplication" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "status" "CastingStatus" NOT NULL DEFAULT 'PENDING',
        "classification" "CastingClassification" NOT NULL DEFAULT 'NONE',
        "internalNotes" TEXT NOT NULL DEFAULT '',
        "answers" JSONB NOT NULL,
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reviewedAt" TIMESTAMP(3),
        "lastReviewedByUserId" TEXT,
        "lastReviewedByName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CastingApplication_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CastingApplication_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  } else {
    if (!(await columnExists(client, "CastingApplication", "classification"))) {
      await client.query(`ALTER TABLE "CastingApplication" ADD COLUMN "classification" "CastingClassification" NOT NULL DEFAULT 'NONE'`);
    }
    if (!(await columnExists(client, "CastingApplication", "lastReviewedByUserId"))) {
      await client.query(`ALTER TABLE "CastingApplication" ADD COLUMN "lastReviewedByUserId" TEXT`);
    }
    if (!(await columnExists(client, "CastingApplication", "lastReviewedByName"))) {
      await client.query(`ALTER TABLE "CastingApplication" ADD COLUMN "lastReviewedByName" TEXT`);
    }
  }

  if (!(await tableExists(client, "CastingReviewEvent"))) {
    console.warn('Schema drift detectado: creando tabla "CastingReviewEvent"...');
    await client.query(`
      CREATE TABLE "CastingReviewEvent" (
        "id" TEXT NOT NULL,
        "applicationId" TEXT NOT NULL,
        "reviewerUserId" TEXT NOT NULL,
        "reviewerName" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "fromValue" TEXT,
        "toValue" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CastingReviewEvent_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CastingReviewEvent_applicationId_fkey"
          FOREIGN KEY ("applicationId") REFERENCES "CastingApplication"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  }

  if (!(await tableExists(client, "CastingBotQueueEvent"))) {
    console.warn('Schema drift detectado: creando tabla "CastingBotQueueEvent"...');
    await client.query(`
      CREATE TABLE "CastingBotQueueEvent" (
        "id" TEXT NOT NULL,
        "applicationId" TEXT NOT NULL,
        "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "queuedBy" TEXT,
        CONSTRAINT "CastingBotQueueEvent_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CastingBotQueueEvent_applicationId_fkey"
          FOREIGN KEY ("applicationId") REFERENCES "CastingApplication"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  }

  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "User_robloxId_key" ON "User"("robloxId")');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "CastingApplication_userId_key" ON "CastingApplication"("userId")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingApplication_status_idx" ON "CastingApplication"("status")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingApplication_classification_idx" ON "CastingApplication"("classification")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingApplication_submittedAt_idx" ON "CastingApplication"("submittedAt")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingReviewEvent_applicationId_createdAt_idx" ON "CastingReviewEvent"("applicationId", "createdAt")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingBotQueueEvent_queuedAt_idx" ON "CastingBotQueueEvent"("queuedAt")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingBotQueueEvent_applicationId_queuedAt_idx" ON "CastingBotQueueEvent"("applicationId", "queuedAt")');

  const checks = {
    castingTable: await tableExists(client, "CastingApplication"),
    auditTable: await tableExists(client, "CastingReviewEvent"),
    botQueueTable: await tableExists(client, "CastingBotQueueEvent"),
    classification: await columnExists(client, "CastingApplication", "classification"),
    lastReviewedByUserId: await columnExists(client, "CastingApplication", "lastReviewedByUserId"),
    lastReviewedByName: await columnExists(client, "CastingApplication", "lastReviewedByName"),
    robloxId: await columnExists(client, "User", "robloxId"),
    robloxUsername: await columnExists(client, "User", "robloxUsername"),
    robloxDisplayName: await columnExists(client, "User", "robloxDisplayName"),
    robloxAvatar: await columnExists(client, "User", "robloxAvatar"),
  };

  if (Object.values(checks).some((value) => !value)) {
    throw new Error(`El schema de casting sigue incompleto: ${JSON.stringify(checks)}`);
  }

  console.log("Schema de casting, revisión e integración del bot verificado correctamente.");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada.");

  const connectionOptions = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  };

  const client = new Client(connectionOptions);
  await client.connect();

  try {
    const hasMigrationHistory = await tableExists(client, "_prisma_migrations");
    const hasExistingUserTable = await tableExists(client, "User");

    if (!hasMigrationHistory && hasExistingUserTable) {
      console.log(`Base existente detectada sin historial Prisma. Marcando ${initialMigration} como baseline...`);
      await client.end();
      runPrisma(["migrate", "resolve", "--applied", initialMigration]);
      console.log("Baseline registrado correctamente.");
    } else if (!hasMigrationHistory && !hasExistingUserTable) {
      console.log("Base vacía detectada. Prisma aplicará todas las migraciones desde cero.");
      await client.end();
    } else {
      console.log("Historial de migraciones Prisma detectado. No es necesario baseline.");
      await client.end();
    }
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }

  runPrisma(["migrate", "deploy"]);

  const verifyClient = new Client(connectionOptions);
  await verifyClient.connect();
  try {
    await ensureCastingSchema(verifyClient);
  } finally {
    await verifyClient.end();
  }
}

main().catch((error) => {
  console.error("Error preparando migraciones:", error);
  process.exit(1);
});
