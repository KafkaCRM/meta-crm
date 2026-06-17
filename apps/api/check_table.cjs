const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    let r = await p['$queryRawUnsafe']('SELECT COUNT(*)::int AS cnt FROM "Party"');
    console.log('Party table exists, rows:', r[0].cnt);
  } catch (e) {
    console.error('Party table MISSING:', e.message);
  }
  try {
    let r = await p['$queryRawUnsafe']('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name', 'public');
    console.log('All tables:', r.map(x => x.table_name).join(', '));
  } catch (e) {
    console.error('Table list error:', e.message);
  }
  await p['$disconnect']();
})();
