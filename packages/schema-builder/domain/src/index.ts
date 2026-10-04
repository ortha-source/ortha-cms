/**
 * Public API of `@orthacms/schema-builder-domain` — the schema builder's
 * framework-free kernel (ADR-0020). Pure TypeScript, usable from the CLI, the
 * server plugin and the admin alike.
 */
export * from './lib/adapters';
export * from './lib/diff';
export * from './lib/document';
export * from './lib/fingerprint';
export * from './lib/manifest';
export * from './lib/classify';
export * from './lib/codegen';
export * from './lib/phases';
export * from './lib/plan';
export { GENERATED_MARKER, isGeneratedSource } from './lib/generated-marker';
