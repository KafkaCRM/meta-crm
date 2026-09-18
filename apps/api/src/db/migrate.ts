import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { db, pool } from './index';

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

async function runMigrations() {
  console.log('⚡ Running Drizzle migrations...');
  await migrate(db, { migrationsFolder: resolve(__dirname, '../../drizzle') });
  console.log('✅ Migrations completed successfully!');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
