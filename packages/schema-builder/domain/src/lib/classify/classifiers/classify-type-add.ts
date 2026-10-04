import type { ChangeOf } from '../../diff/schema-change';
import { verdict } from '../classified-change';

/** A new type is a new table nobody is granted yet — nothing existing can break. */
export const classifyTypeAdd = (change: ChangeOf<'type.add'>) =>
    verdict(change, 'safe', 'new-type', true);
