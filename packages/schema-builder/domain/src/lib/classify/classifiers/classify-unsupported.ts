import type { ChangeOf } from '../../diff/schema-change';
import { verdict } from '../classified-change';

/**
 * drizzle-kit would ask whether a dropped-and-added column is a rename, and a
 * retype needs a data migration. Neither is applied by this version.
 */
export const classifyUnsupported = (
    change: ChangeOf<'field.rename' | 'field.retype'>
) =>
    verdict(
        change,
        'blocked',
        change.kind === 'field.rename'
            ? 'rename-unsupported'
            : 'retype-unsupported',
        true
    );
