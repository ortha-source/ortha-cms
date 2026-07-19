/**
 * Public API of `@ortha-cms/content-domain` — the shared content **kernel**.
 *
 * Pure TypeScript (no React, no NestJS, no Drizzle): the rules both the server
 * and the admin must apply identically. Per ADR-0003 this is the single
 * sanctioned FE↔BE code share, and it holds only what genuinely needs to agree:
 * the entry-status state machine, field-value validation, and the publish gate.
 */

export {
    ENTRY_STATUS,
    canTransition,
    assertTransition,
    EntryStatusTransitionError
} from './lib/status/entry-status';
export type { EntryStatus } from './lib/status/entry-status';

export { CONTENT_FIELD_TYPE, isEmptyFieldValue } from './lib/fields/field-type';
export type { FieldType } from './lib/fields/field-type';
export type {
    EntryFieldSpec,
    EntryFieldSpecMap,
    FieldValidationRules
} from './lib/fields/field-spec';

export {
    validateEntryValues,
    validateFieldValue
} from './lib/validation/validate-entry-values';
export type { ValidateEntryValuesOptions } from './lib/validation/validate-entry-values';
export type {
    ValidationIssue,
    ValidationResult
} from './lib/validation/validation-result';
export { canPublish } from './lib/validation/publish-gate';
