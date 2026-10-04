import type { ChangeOf } from '../../diff/schema-change';
import { verdict } from '../classified-change';

/**
 * Only turning the trash on is a plain nullable column. Everything else needs
 * a data migration this version does not write: `i18n` needs a `locale` on
 * every row, `publishable` changes what `required` means, and turning the
 * trash off would lose the tombstoned rows.
 */
export function classifyTypeFlag(change: ChangeOf<'type.flag'>) {
    return change.flag === 'paranoid' && change.to
        ? verdict(change, 'safe', 'trash-column', true)
        : verdict(change, 'blocked', 'flag-needs-data-migration', true);
}
