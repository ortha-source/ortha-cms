import type { ChangeOf } from '../../diff/schema-change';
import { isLiveType, type ClassifyContext } from '../change-facts';
import { verdict } from '../classified-change';

/**
 * On a live type `required` is NOT NULL, and the DSL has no default value, so
 * existing rows would fail the ALTER. A required boolean gets DEFAULT false.
 * Relations and media store no column on the main table when they are many,
 * but a single relation is still a column — every field add is storage.
 */
export function classifyFieldAdd(
    change: ChangeOf<'field.add'>,
    ctx: ClassifyContext
) {
    const notNull =
        isLiveType(ctx, change.type) &&
        !!change.spec.required &&
        change.spec.type !== 'boolean';
    return notNull && ctx.facts.rows(change.type) > 0
        ? verdict(change, 'blocked', 'required-on-live-type', true)
        : verdict(change, 'safe', 'nullable-column', true);
}
