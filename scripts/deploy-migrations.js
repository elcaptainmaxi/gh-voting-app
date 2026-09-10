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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const hasMigrationHistory = await tableExists(client, "_prisma_migrations");
    const hasExistingUserTable = await tableExists(client, "User");

    if (!hasMigrationHistory && hasExistingUserTable) {
      console.log(`Base existente detectada sin historial Prisma. Marcando ${initialMigration} como baseline...`);
      runPrisma(["migrate", "resolve", "--applied", initialMigration]);
      console.log("Baseline registrado correctamente.");
    } else if (!hasMigrationHistory && !hasExistingUserTable) {
      console.log("Base vacía detectada. Prisma aplicará todas las migraciones desde cero.");
    } else {
      console.log("Historial de migraciones Prisma detectado. No es necesario baseline.");
    }
  } finally {
    await client.end();
  }

  runPrisma(["migrate", "deploy"]);
}

main().catch((error) => {
  console.error("Error preparando migraciones:", error);
  process.exit(1);
});
