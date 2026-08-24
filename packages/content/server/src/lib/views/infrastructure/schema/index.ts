/**
 * The saved-views schema barrel — also the entry point `drizzle.config.ts`
 * diffs. `external-refs.ts` is deliberately absent: those stubs exist only so
 * the foreign keys resolve, and re-exporting them here would make drizzle-kit
 * emit a duplicate `CREATE TABLE users`.
 */
export { savedViews, savedViewDefaults, viewVisibility } from './saved-views';
