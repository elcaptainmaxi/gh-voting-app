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
  const hasUserTable = await tableExists(client, "User");
  if (!hasUserTable) {
    throw new Error('No existe la tabla "User" después de aplicar migraciones.');
  }

  const robloxColumns = [
    ["robloxId", "TEXT"],
    ["robloxUsername", "TEXT"],
    ["robloxDisplayName", "TEXT"],
    ["robloxAvatar", "TEXT"],
  ];

  for (const [columnName, sqlType] of robloxColumns) {
    if (!(await columnExists(client, "User", columnName))) {
      console.warn(`Schema drift detectado: agregando User.${columnName}...`);
      await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType}`);
    }
  }

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CastingStatus') THEN
        CREATE TYPE "CastingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
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
        "internalNotes" TEXT NOT NULL DEFAULT '',
        "answers" JSONB NOT NULL,
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reviewedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CastingApplication_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CastingApplication_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  }

  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "User_robloxId_key" ON "User"("robloxId")');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "CastingApplication_userId_key" ON "CastingApplication"("userId")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingApplication_status_idx" ON "CastingApplication"("status")');
  await client.query('CREATE INDEX IF NOT EXISTS "CastingApplication_submittedAt_idx" ON "CastingApplication"("submittedAt")');

  const checks = {
    castingTable: await tableExists(client, "CastingApplication"),
    robloxId: await columnExists(client, "User", "robloxId"),
    robloxUsername: await columnExists(client, "User", "robloxUsername"),
    robloxDisplayName: await columnExists(client, "User", "robloxDisplayName"),
    robloxAvatar: await columnExists(client, "User", "robloxAvatar"),
  };

  if (Object.values(checks).some((value) => !value)) {
    throw new Error(`El schema de casting sigue incompleto: ${JSON.stringify(checks)}`);
  }

  console.log("Schema de casting verificado correctamente.");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada.");
  }

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
    if (!client.ended) {
      await client.end().catch(() => {});
    }
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
