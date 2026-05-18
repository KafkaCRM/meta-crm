export const healthcarePluginManifest = {
  id: 'plugin-healthcare',
  name: 'Healthcare Plugin',
  version: '1.0.0',
  description: 'Appointment reminders and patient note formatting for healthcare tenants',
  compatible_industries: ['healthcare'],
  hooks: ['case:stage_changed'],
  extends: ['Case'],
} as const;
