import 'dotenv/config';

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Falta la variable de entorno: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  APP_URL: required('APP_URL', 'http://localhost:3000'),
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
  DISCORD_CLIENT_SECRET: required('DISCORD_CLIENT_SECRET'),
  DISCORD_REDIRECT_URI: required('DISCORD_REDIRECT_URI'),
  ADMIN_DISCORD_ID: required('ADMIN_DISCORD_ID'),
  IP_HASH_SECRET: required('IP_HASH_SECRET'),
  TRUST_PROXY: process.env.TRUST_PROXY || 'loopback',
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  VOTE_RATE_LIMIT_MAX: Number(process.env.VOTE_RATE_LIMIT_MAX || 10)
};

export const isProduction = env.NODE_ENV === 'production';
