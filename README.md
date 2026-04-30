# GH Voting App

Aplicación full stack de votación estilo reality con:
- Login obligatorio con Discord OAuth2
- Un voto por usuario por placa activa
- Límite por IP para reducir multi-cuentas
- Panel admin protegido por Discord ID
- Resultados visibles solo para admin

## Stack
- Frontend: HTML, CSS y JavaScript vanilla
- Backend: Node.js + Express
- DB: PostgreSQL + Prisma ORM
- Sesiones: express-session + connect-pg-simple

## Instalación rápida
1. Copiá `.env.example` a `.env`
2. Configurá PostgreSQL y Discord OAuth
3. Ejecutá:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run db:seed
   npm run dev
   ```
4. Abrí `http://localhost:3000`

## Flujo
- `/` Login público
- `/vote.html` Pantalla para votar
- `/admin.html` Panel protegido por Discord ID

## Nota sobre IP
La app guarda un hash HMAC de la IP, no la IP en texto plano. Para despliegue detrás de proxy, configurá `TRUST_PROXY` correctamente.
