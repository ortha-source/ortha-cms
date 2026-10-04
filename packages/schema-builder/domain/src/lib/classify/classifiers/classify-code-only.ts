import type { ChangeOf } from '../../diff/schema-change';
import { verdict } from '../classified-change';

/** Labels, the page path, groups, field order: the code changes, the database does not. */
export const classifyCodeOnly = (
    change: ChangeOf<'type.meta' | 'field.reorder'>
) => verdict(change, 'safe', 'code-only', false);
