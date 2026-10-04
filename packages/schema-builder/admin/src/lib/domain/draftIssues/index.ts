import { checkTypes, type SchemaIssue } from '@orthacms/content-domain';
import {
    toRuleType,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';

/**
 * [schema-builder:I-10] The draft's issues, by the rules the DSL and the
 * server run — the editor shows every one, the DSL would throw the first.
 */
export const draftIssues = (doc: SchemaDocument): SchemaIssue[] =>
    checkTypes(doc.types.map(toRuleType));

/** The issues about one type, its fields and groups included. */
export const typeIssues = (
    issues: readonly SchemaIssue[],
    type: string
): SchemaIssue[] =>
    issues.filter(
        (issue) => issue.path === type || issue.path.startsWith(`${type}.`)
    );

/** The issues about one field. */
export const fieldIssues = (
    issues: readonly SchemaIssue[],
    type: string,
    field: string
): SchemaIssue[] =>
    issues.filter((issue) => issue.path === `${type}.fields.${field}`);
