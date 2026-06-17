const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const tables = await p['$queryRawUnsafe']("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables in DB:');
    tables.forEach(t => console.log(' - ' + t.table_name));
  } catch(e) {
    console.error('Error:', e.message);
  }
  await p['$disconnect']();
})();
