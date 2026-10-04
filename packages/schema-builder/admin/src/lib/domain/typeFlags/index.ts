import type { TypeDoc } from '@orthacms/schema-builder-domain';

/** One of a type's three storage flags. */
export type TypeFlag = 'publishable' | 'paranoid' | 'i18n';

/**
 * Whether a flag may change in the draft. A new type may set all three; an
 * existing one may only turn the trash **on** — every other flip needs a data
 * migration the builder does not write, and plan would block it.
 *
 * Judged against the **served** type, not the draft's: until an apply, a
 * flag the draft changed can always go back to what is served. Judging the
 * draft's own value locked the trash on the moment it was switched on — and
 * the trash is the only flag an existing type may change at all.
 */
export function canChangeFlag(
    type: TypeDoc,
    flag: TypeFlag,
    served: TypeDoc | undefined
): boolean {
    if (type.origin === 'new' || !served) return true;
    return flag === 'paranoid' && !served.paranoid;
}
