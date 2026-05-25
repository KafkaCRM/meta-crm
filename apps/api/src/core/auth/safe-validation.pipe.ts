import { ValidationPipe, ArgumentMetadata, Injectable } from '@nestjs/common';

@Injectable()
export class SafeValidationPipe extends ValidationPipe {
  override async transform(value: any, metadata: ArgumentMetadata) {
    // Run standard class-validator and class-transformer validations
    const validatedValue = await super.transform(value, metadata);
    // Recursively sanitize input strings to strip XSS vectors
    return this.sanitize(validatedValue);
  }

  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/src\s*=\s*['"]?javascript:/gi, '')
        .replace(/onerror\s*=/gi, '')
        .replace(/onload\s*=/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    if (typeof obj === 'object') {
      // Do not mutate database service instances or complex system structures
      if (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array') {
        return obj;
      }
      const sanitized: any = {};
      for (const [key, val] of Object.entries(obj)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    return obj;
  }
}
