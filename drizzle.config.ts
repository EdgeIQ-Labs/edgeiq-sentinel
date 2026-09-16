import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: new URL('./packages/db/src/schema.ts', import.meta.url).pathname,
  out: new URL('./packages/db/drizzle', import.meta.url).pathname,
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:sentinel123@localhost:5435/sentinel',
  },
});
