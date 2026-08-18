import { BadRequestException } from '@nestjs/common';
import { BULK_SAVE_OP, type BulkSaveOp } from '../types/public-bulk';
import type { EntryLocator } from './public-entries.query';

/**
 * What one bulk-save item was addressed as — a **discriminated union**, so a
 * caller that has checked `op` gets the locator without a fallback for a case
 * the resolver never produces.
 */
export type ResolvedBulkSaveOp =
    | { op: typeof BULK_SAVE_OP.Create }
    | {
          op: typeof BULK_SAVE_OP.Update;
          /** Which row the update targets. */
          locator: EntryLocator;
          /**
           * The addressing locale of a group-addressed update — the query
           * string's `?locale=` on the single-entry route.
           *
           * Only ever set for an update, and deliberately so: on a **create**
           * the item's `locale` stamps the new row, and passing it as an
           * addressing locale is the exact confusion that let a group-addressed
           * German update rewrite the English row (see
           * `PublicEntryWritesService.update`).
           */
          locale?: string;
      };

/** The addressing fields a bulk-save item may carry. */
interface BulkSaveItemAddress {
    id?: string;
    localeGroupId?: string;
    locale?: string;
    op?: BulkSaveOp;
}

/**
 * Decide what one bulk-save item does, from how it is addressed.
 *
 * A single-entry write says this in its **URL** — `POST /:typeName` creates,
 * `PATCH /:typeName/:id` updates, `PATCH /:typeName/group/:gid?locale=` updates
 * a translation. A batch has one URL for every item, so the addressing moves
 * into the item and this function is the one place that reads it. The rules:
 *
 * - `id` → **update** that row. An entry id already names one row, including
 *   its locale, so no addressing locale is involved.
 * - neither `id` nor `localeGroupId` → **create**.
 * - `localeGroupId` alone → genuinely ambiguous, so `op` is **required**:
 *   `create` adds that record's row in `locale` (joining the group), `update`
 *   changes the row the group already has there.
 *
 * `op` may always be stated explicitly, and disagreeing with the addressing is
 * an error rather than a silent preference — `{ op: 'create', id }` is a caller
 * who believes one thing while the request says another, and picking a winner
 * would make whichever they did not mean happen quietly.
 */
export function resolveBulkSaveOp(
    item: BulkSaveItemAddress
): ResolvedBulkSaveOp {
    const id = nonEmpty(item.id);
    const localeGroupId = nonEmpty(item.localeGroupId);

    if (id && localeGroupId) {
        throw new BadRequestException(
            'Pass either `id` or `localeGroupId`, not both — they are two ways of naming the same row.'
        );
    }

    if (id) {
        if (item.op === BULK_SAVE_OP.Create) {
            throw new BadRequestException(
                '`op: "create"` cannot carry an `id` — an id names an entry that already exists. Drop the id to create, or drop `op` to update it.'
            );
        }
        return { op: BULK_SAVE_OP.Update, locator: { id } };
    }

    if (!localeGroupId) {
        if (item.op === BULK_SAVE_OP.Update) {
            throw new BadRequestException(
                '`op: "update"` needs an `id`, or a `localeGroupId` with the `locale` to change.'
            );
        }
        return { op: BULK_SAVE_OP.Create };
    }

    // A group id and nothing else. Both readings are things a caller really
    // wants, and neither is the obvious default, so ask rather than guess.
    if (!item.op) {
        throw new BadRequestException(
            'This item names a `localeGroupId` but no `id`, so it could either create that record’s row in `locale` or update the row it already has there. Say which with `op: "create"` or `op: "update"`.'
        );
    }
    if (item.op === BULK_SAVE_OP.Create) {
        return { op: BULK_SAVE_OP.Create };
    }
    return {
        op: BULK_SAVE_OP.Update,
        locator: { localeGroupId },
        ...(nonEmpty(item.locale) ? { locale: item.locale } : {})
    };
}

/** A present, non-empty string, or `undefined`. */
function nonEmpty(value: string | undefined): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
