import type { TypeDoc } from '@orthacms/schema-builder-domain';

/** One of a type's three storage flags. */
export type TypeFlag = 'publishable' | 'paranoid' | 'i18n';

/**
 * Whether a flag may change. A new type may set all three; an existing one
 * may only turn the trash **on** — every other flip needs a data migration the
 * builder does not write, and plan would block it.
 */
export function canChangeFlag(type: TypeDoc, flag: TypeFlag): boolean {
    if (type.origin === 'new') return true;
    return flag === 'paranoid' && !type.paranoid;
}
