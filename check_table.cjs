const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    let r = await p['$queryRawUnsafe']('SELECT COUNT(*)::int AS cnt FROM "Party"');
    console.log('Party table exists, rows:', r[0].cnt);
  } catch (e) {
    console.error('Party table MISSING:', e.message);
  }
  await p['$disconnect']();
})();
