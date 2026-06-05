import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { TemplateService } from './apps/api/src/core/metadata/template.service';
import { TenantScopedPrismaService } from './apps/api/src/core/tenant/tenant-scoped-prisma.service';

async function bootstrap() {
  console.log('Bootstrapping NestJS context to apply healthcare template...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(TemplateService);
  const db = app.get(TenantScopedPrismaService);

  const tenant = await db.getClient().tenant.findUnique({
    where: { slug: 'acme-corp' },
  });

  if (!tenant) {
    console.error('Tenant "acme-corp" not found. Please run db:seed first.');
    await app.close();
    return;
  }

  const tenantId = tenant.id;
  console.log('Applying healthcare template to tenant:', tenantId);
  const result = await service.applyIndustryTemplate('healthcare', tenantId);

  if (result.isErr()) {
    console.error('Template application failed:', result.error);
  } else {
    console.log('Template application succeeded!');
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error in bootstrap:', err);
});
