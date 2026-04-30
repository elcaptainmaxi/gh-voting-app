import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.ADMIN_DISCORD_ID) {
    console.log('ADMIN_DISCORD_ID no está definido. Seed omitido.');
    return;
  }

  await prisma.user.upsert({
    where: { discordId: process.env.ADMIN_DISCORD_ID },
    update: { isAdmin: true, username: 'admin', globalName: 'Admin' },
    create: {
      discordId: process.env.ADMIN_DISCORD_ID,
      username: 'admin',
      globalName: 'Admin',
      isAdmin: true
    }
  });

  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
