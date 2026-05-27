import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlatformTenantsService } from './platform/tenants/platform-tenants.service';

async function bootstrap() {
  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(PlatformTenantsService);

  console.log('Attempting to create tenant with capabilities...');
  const result = await service.create({
    name: 'Test Caps Tenant',
    slug: 'test-caps-tenant-' + Date.now(),
    industry: 'healthcare',
    plan_id: 'cmplgivfs0000pogxg67x9zck',
    owner: {
      name: 'Owner Test',
      email: 'owner-caps-' + Date.now() + '@test.com',
    },
    capabilities: ['capability/billing', 'capability/property-listing'],
  });

  if (result.isErr()) {
    console.error('Tenant creation failed:', result.error);
  } else {
    console.log('Tenant creation succeeded:', result.value);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error in bootstrap:', err);
});
