import { z } from 'zod';

export const FrontendPluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  compatible_industries: z.array(z.string()),
  requires_plan: z.string().optional(),
  hooks: z.array(z.string()).optional(),
  extends: z.record(z.string(), z.array(z.string())).optional(),
});

export type FrontendPluginManifest = z.infer<typeof FrontendPluginManifestSchema>;

export const TenantActiveModulesSchema = z.object({
  plugin_ids: z.array(z.string()),
});

export type TenantActiveModules = z.infer<typeof TenantActiveModulesSchema>;

export interface SlotContextData {
  caseId?: string;
  caseData?: any;
  [key: string]: any;
}
