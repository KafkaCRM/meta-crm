import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TemplateService } from './core/metadata/template.service';
import { TenantScopedPrismaService } from './core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';

async function bootstrap() {
  console.log('Bootstrapping NestJS context to apply healthcare template...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(TemplateService);
  const db = app.get(TenantScopedPrismaService);
  const cls = app.get(ClsService);

  const tenant = await db.getClient().tenant.findUnique({
    where: { slug: 'acme-corp' },
  });

  if (!tenant) {
    console.error('Tenant "acme-corp" not found. Please seed the database first.');
    await app.close();
    return;
  }

  const tenantId = tenant.id;
  console.log('Applying healthcare template to tenant:', tenantId);

  let result: any;
  await cls.run(async () => {
    cls.set('scope', {
      tenant_id: tenantId,
      user_id: 'system',
      role: 'tenant_admin',
    });
    result = await service.applyIndustryTemplate('healthcare', tenantId);
  });

  if (result && result.isErr()) {
    console.error('Template application failed:', result.error);
  } else {
    console.log('Template application succeeded!');
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error in bootstrap:', err);
});

