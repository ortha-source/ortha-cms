import { fieldPass } from './check-type';
import { checkLang } from './option-rules/check-lang';
import { checkMediaAccept } from './option-rules/check-media-accept';
import { checkPattern } from './option-rules/check-pattern';
import type { FieldRule } from './rule';
import type { RuleType } from './rule-type';
import type { SchemaIssue } from './schema-issue';

/**
 * Option-level checks. The DSL's field builders throw on these before a type
 * exists (`field.text({ pattern })`, `lang`, `accept.kinds`); a schema built
 * from data — the builder's document — has no builder call to throw, so it
 * runs them here.
 */
export const OPTION_RULES: readonly FieldRule[] = [
    checkLang,
    checkPattern,
    checkMediaAccept
];

export const checkFieldOptions = (type: RuleType): SchemaIssue[] =>
    fieldPass(type, OPTION_RULES);
