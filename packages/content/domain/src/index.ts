/**
 * Public API of `@orthacms/content-domain` — the shared content **kernel**.
 *
 * Pure TypeScript (no React, no NestJS, no Drizzle): the rules both the server
 * and the admin must apply identically. Per ADR-0003 this is the single
 * sanctioned FE↔BE code share, and it holds only what genuinely needs to agree:
 * the entry-status state machine, the rich-text document model, field-value
 * validation, the publish gate, the schema rules a content type must satisfy,
 * and the General tab's field order.
 */

export {
    ENTRY_STATUS,
    canTransition,
    assertTransition,
    EntryStatusTransitionError
} from './lib/status/entry-status';
export type { EntryStatus } from './lib/status/entry-status';

export {
    CONTENT_FIELD_TYPE,
    countCharacters,
    isEmptyFieldValue
} from './lib/fields/field-type';
export type { FieldType } from './lib/fields/field-type';
export type {
    EntryFieldSpec,
    EntryFieldSpecMap,
    FieldValidationRules,
    RichTextStructureMode
} from './lib/fields/field-spec';

export {
    isMediaValueRef,
    toMediaValueRef,
    mediaValueIds,
    hasTextAlternative,
    MEDIA_ALT_MAX_LENGTH
} from './lib/fields/media-value';
export type { MediaValueRef, MediaValueInput } from './lib/fields/media-value';
export { MEDIA_KIND_VALUES, isMediaKind } from './lib/fields/media-kind';
export {
    DEFAULT_NOW,
    DEFAULT_TODAY,
    DEFAULT_VALUE_FIELD_TYPES,
    defaultValueProblem,
    isRelativeDefault,
    takesDefaultValue
} from './lib/fields/default-value';
export type { MediaKind } from './lib/fields/media-kind';

export { RICH_TEXT_MARK, RICH_TEXT_NODE } from './lib/richtext/rich-text-node';
export type {
    RichTextDocument,
    RichTextMark,
    RichTextNode
} from './lib/richtext/rich-text-node';
export {
    isRichTextDocument,
    isRichTextNode,
    langOf,
    walkRichText
} from './lib/richtext/rich-text-node';
export {
    asRichTextDocument,
    isEmptyRichText,
    isEmptyRichTextDocument,
    richTextDocumentText,
    richTextPlainText
} from './lib/richtext/rich-text-document';
export {
    htmlToPlainText,
    htmlToRichTextDocument
} from './lib/richtext/html-to-document';
export { richTextToHtml } from './lib/richtext/document-to-html';
export { isWellFormedLanguageTag } from './lib/richtext/language-tag';
export {
    RICH_TEXT_ISSUE,
    inspectRichText
} from './lib/richtext/rich-text-structure';
export type {
    RichTextIssueCode,
    RichTextIssueSeverity,
    RichTextStructureIssue
} from './lib/richtext/rich-text-structure';

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

export {
    checkFieldOptions,
    checkFieldWidth,
    checkType,
    checkTypeSet,
    checkTypes,
    fieldPass,
    fieldPath,
    groupPath,
    issue,
    mainColumnName,
    snakeCase,
    typePath,
    FIELD_RULES,
    FIELD_WIDTHS,
    GROUP_KEY_RE,
    GROUP_RULES,
    LAYOUT_RULES,
    OPTION_RULES,
    RESERVED_COLUMNS,
    SET_RULES,
    TYPE_NAME_RE,
    TYPE_RULES
} from './lib/schema-rules';
export type {
    FieldPass,
    FieldRule,
    RuleField,
    RuleGroup,
    RuleRelation,
    RuleType,
    SchemaIssue,
    SchemaIssueCode,
    SetRule,
    TypeRule
} from './lib/schema-rules';

export {
    GENERAL_TAB_DEFAULT_RANK,
    GENERAL_TAB_RANK,
    generalTabRank,
    orderGeneralTab
} from './lib/layout/general-tab-order';
