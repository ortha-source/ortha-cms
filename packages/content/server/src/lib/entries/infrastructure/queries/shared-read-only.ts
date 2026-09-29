import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import type { EntrySource } from '../../types/entry-list-view';
import type { SharedSourcesQuery } from './shared-sources.query';

/**
 * The advice every refusal ends with — what an agent should do instead of
 * writing a shared record (ADR-0019). Kept in one place so the MCP and copilot
 * tools cannot drift into two different instructions.
 */
const LINK_INSTEAD =
    'To use a shared record, link to it by id from a record in this workspace; never create a local copy.';

/**
 * The refusal an agent tool gives for a record it can **see** but not change:
 * a visible entry of a shared workspace (ADR-0019).
 *
 * Only ever thrown for a key the caller could already read — see
 * `SharedSourcesQuery.foreignVisibleRows` — so it discloses nothing a read
 * would not; an unknown, draft, deleted or ungranted id keeps its ordinary
 * not-found. A 403, because the record exists for this caller and the
 * operation is what is refused.
 */
export class SharedRecordReadOnlyException extends ForbiddenException {
    constructor(source: EntrySource, detail?: string) {
        super(
            `This record belongs to the shared workspace "${source.workspaceName}" and is ` +
                `read-only here${detail ? ` — ${detail}` : ''}. ${LINK_INSTEAD}`
        );
    }
}

/**
 * The batch form of {@link SharedRecordReadOnlyException}: some of the listed
 * ids are visible shared-workspace records. Thrown **before** anything is
 * written, so the message can say that nothing changed.
 */
export class SharedRecordsReadOnlyException extends ForbiddenException {
    constructor(ids: readonly string[]) {
        super(
            `${ids.length === 1 ? 'This id belongs' : `${ids.length} of these ids belong`} to a ` +
                `shared workspace and ${ids.length === 1 ? 'is' : 'are'} read-only here: ` +
                `${ids.join(', ')}. Nothing was changed. Remove ${ids.length === 1 ? 'it' : 'them'} ` +
                `from the batch. ${LINK_INSTEAD}`
        );
    }
}

/**
 * Run `operation`; if it fails with a **not-found**, ask `probe` whether the
 * key it named is a visible shared-workspace record and, if so, replace the
 * 404 with {@link SharedRecordReadOnlyException}.
 *
 * Probing only on the failure path keeps the ordinary write at its old cost,
 * and the write itself never reaches a foreign row — it keeps its strict
 * own-workspace predicate — so this changes the *message*, never the outcome.
 */
export async function explainSharedNotFound<T>(
    operation: () => Promise<T>,
    probe: () => Promise<EntrySource | undefined>,
    detail?: string
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof NotFoundException) {
            const source = await probe();
            if (source) {
                throw new SharedRecordReadOnlyException(source, detail);
            }
        }
        throw error;
    }
}

/**
 * The admin-side probe for {@link explainSharedNotFound}: is `id` a visible
 * shared-workspace entry of `type` for `workspaceId`? The copilot's tools and
 * appliers read through the admin services, so no reader scope applies — the
 * same rule `EntryWriterService.getVisible` answers with. `undefined` when the
 * query is not bound (an absent binding degrades to plain isolation).
 */
export function sharedEntryProbe(
    shared: SharedSourcesQuery | undefined,
    type: AnyContentType,
    id: string,
    workspaceId: string
): () => Promise<EntrySource | undefined> {
    return async () =>
        shared
            ? (await shared.foreignVisibleRows(type, [id], workspaceId)).get(id)
            : undefined;
}
