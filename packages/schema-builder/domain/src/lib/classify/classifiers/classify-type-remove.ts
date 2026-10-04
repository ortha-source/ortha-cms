import type { ChangeOf } from '../../diff/schema-change';
import type { ClassifyContext } from '../change-facts';
import { verdict } from '../classified-change';

/**
 * Dropping a type drops its table. Blocked while any workspace holds a grant
 * (revoking already refuses while entries exist) or another type links to it.
 */
export function classifyTypeRemove(
    change: ChangeOf<'type.remove'>,
    { facts }: ClassifyContext
) {
    const inUse =
        facts.grantedTo(change.type) > 0 ||
        facts.referencedBy(change.type).length > 0;
    return inUse
        ? verdict(change, 'blocked', 'type-in-use', true)
        : verdict(change, 'destructive', 'drops-data', true);
}
