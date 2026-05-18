export class MissingTenantContextError extends Error {
  constructor() {
    super('Missing tenant context');
    this.name = 'MissingTenantContextError';
  }
}
