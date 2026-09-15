import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sentinel';
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
export * from './schema.js';
