import type { SetRule } from './rule';
import type { RuleType } from './rule-type';
import type { SchemaIssue } from './schema-issue';
import { checkDuplicateNames } from './set-rules/check-duplicate-names';
import { checkRelationLinks } from './set-rules/check-relation-links';

/** What the registry checks when the types meet: unique names, resolvable links. */
export const SET_RULES: readonly SetRule[] = [
    checkDuplicateNames,
    checkRelationLinks
];

export const checkTypeSet = (types: readonly RuleType[]): SchemaIssue[] =>
    SET_RULES.flatMap((rule) => rule(types));
