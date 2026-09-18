import { Hono } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { leads, invoices, parties, setupAuditTrails } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const reportsRouter = new Hono<AppEnv>();

reportsRouter.use('*', requireAuth, requireTenant);

reportsRouter.get('/', async (c) => {
  const scope = c.get('scope');

  // Summary KPI stats
  const totalLeads = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.tenantId, scope.tenant_id)));

  const convertedLeads = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.tenantId, scope.tenant_id), eq(leads.status, 'converted')));

  const totalContacts = await db
    .select({ count: sql<number>`count(*)` })
    .from(parties)
    .where(and(eq(parties.tenantId, scope.tenant_id)));

  const revenueStats = await db
    .select({ total: sql<number>`coalesce(sum(${invoices.amount}), 0)` })
    .from(invoices)
    .where(and(eq(invoices.tenantId, scope.tenant_id), eq(invoices.status, 'paid')));

  const leadsByStatus = await db
    .select({ status: leads.status, count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.tenantId, scope.tenant_id))
    .groupBy(leads.status);

  const leadsBySource = await db
    .select({ source: leads.source, count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.tenantId, scope.tenant_id))
    .groupBy(leads.source);

  return c.json({
    kpis: {
      total_leads: Number(totalLeads[0]?.count || 0),
      converted_leads: Number(convertedLeads[0]?.count || 0),
      conversion_rate:
        Number(totalLeads[0]?.count || 0) > 0
          ? Math.round((Number(convertedLeads[0]?.count || 0) / Number(totalLeads[0]?.count || 1)) * 100)
          : 0,
      total_contacts: Number(totalContacts[0]?.count || 0),
      total_revenue: Number(revenueStats[0]?.total || 0),
    },
    by_status: leadsByStatus.map((s) => ({ name: s.status, value: Number(s.count) })),
    by_source: leadsBySource.map((s) => ({ name: s.source, value: Number(s.count) })),
  });
});

reportsRouter.get('/setup-audits', async (c) => {
  const scope = c.get('scope');
  const audits = await db.query.setupAuditTrails.findMany({
    where: eq(setupAuditTrails.tenantId, scope.tenant_id),
    orderBy: [desc(setupAuditTrails.createdAt)],
    limit: 50,
  });
  return c.json(audits);
});
