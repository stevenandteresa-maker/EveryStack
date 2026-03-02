// Schema barrel file — all Drizzle table definitions are re-exported from here.
// Usage: import { users, tenants } from '@everystack/shared/db';

export { users } from './users';
export type { User, NewUser } from './users';

export { tenants } from './tenants';
export type { Tenant, NewTenant } from './tenants';
