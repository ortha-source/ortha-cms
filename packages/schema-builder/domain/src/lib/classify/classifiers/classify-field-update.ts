import type { ChangeOf } from '../../diff/schema-change';
import { isLiveType, type ClassifyContext } from '../change-facts';
import { verdict } from '../classified-change';

/** Keys that change the relation's storage: its FK, its UNIQUE, its join table. */
const RELATION_KEYS = ['to', 'many', 'unique', 'onDelete', 'inverseOf'];
/** Keys that change what counts as a valid value, and nothing in the database. */
const RULE_KEYS = [
    'minLength',
    'maxLength',
    'pattern',
    'min',
    'max',
    'integer',
    'options',
    'accept',
    'structure',
    'multiple'
];

const touches = (keys: readonly string[], set: readonly string[]) =>
    keys.some((key) => set.includes(key));

export function classifyFieldUpdate(
    change: ChangeOf<'field.update'>,
    ctx: ClassifyContext
) {
    if (change.keys.includes('required') && isLiveType(ctx, change.type)) {
        return verdict(change, 'data', 'not-null-toggle', true);
    }
    if (
        change.after.type === 'relation' &&
        touches(change.keys, RELATION_KEYS)
    ) {
        return verdict(change, 'data', 'relation-constraint', true);
    }
    if (touches(change.keys, RULE_KEYS))
        return verdict(change, 'data', 'constraint-tightened', false);
    return verdict(change, 'safe', 'code-only', false);
}
