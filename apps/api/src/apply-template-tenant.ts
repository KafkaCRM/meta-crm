import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TemplateService } from './core/metadata/template.service';

async function bootstrap() {
  console.log('Bootstrapping NestJS context to apply healthcare template...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(TemplateService);

  const tenantId = 'cmpnfzrte000108gx0i4kq3lf';
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
