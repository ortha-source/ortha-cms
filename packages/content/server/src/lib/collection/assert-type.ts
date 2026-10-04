import { checkType } from '@orthacms/content-domain';
import type { AnyFieldSpec } from '../types/fields';
import { toRuleType, type RuleTypeHead } from './to-rule-type';

/**
 * The DSL's contract: a declaration error is a build error. The rules live in
 * the content kernel; this throws the first one, in the order they always ran.
 */
export function assertType(
    head: RuleTypeHead,
    fields: Readonly<Record<string, AnyFieldSpec>>
): void {
    const [first] = checkType(toRuleType(head, fields));
    if (first) throw new Error(first.message);
}
