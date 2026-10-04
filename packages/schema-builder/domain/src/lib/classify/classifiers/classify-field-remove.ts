import type { ChangeOf } from '../../diff/schema-change';
import { verdict } from '../classified-change';

/** A removed field drops its column or join table, and every value in it. */
export const classifyFieldRemove = (change: ChangeOf<'field.remove'>) =>
    verdict(change, 'destructive', 'drops-data', true);
