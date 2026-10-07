import { useQueries } from '@tanstack/react-query';
import { defineMessages, useIntl } from 'react-intl';
import type {
    PublishAnnotation,
    PublishAnnotations,
    PublishEntry,
    PublishSlotContext
} from '@orthacms/publishing-admin';
import { httpProtectionGateway } from '../../infrastructure/protectionGateway';
import { reviewStatusKey } from '../../infrastructure/protectionKeys';
import type { EntryReviewStatus } from '../../domain/types';

const messages = defineMessages({
    held: {
        id: 'protection.publishing.held',
        defaultMessage: 'Approvals {given}/{required}'
    },
    heldRequested: {
        id: 'protection.publishing.heldRequested',
        defaultMessage:
            'Review requested — publishing is held until {required, plural, one {# approval is} other {# approvals are}} given on this version.'
    },
    heldUnrequested: {
        id: 'protection.publishing.heldUnrequested',
        defaultMessage:
            'Publishing is held until {required, plural, one {# approval is} other {# approvals are}} given on this version. No review has been requested.'
    },
    approved: {
        id: 'protection.publishing.approved',
        defaultMessage: 'Approved'
    },
    approvedDescription: {
        id: 'protection.publishing.approvedDescription',
        defaultMessage:
            '{given} of {required} required approvals on this version.'
    }
});

/** Most ids the status read takes per request (the server's cap). */
const STATUS_CHUNK = 100;

/** The status read for one type's ids, in slices the server accepts. */
async function statusFor(
    typeName: string,
    ids: readonly string[]
): Promise<Record<string, EntryReviewStatus>> {
    const merged: Record<string, EntryReviewStatus> = {};
    for (let start = 0; start < ids.length; start += STATUS_CHUNK) {
        Object.assign(
            merged,
            await httpProtectionGateway.reviewStatusByEntry(
                typeName,
                ids.slice(start, start + STATUS_CHUNK)
            )
        );
    }
    return merged;
}

/**
 * **Approval status** in the Publish Manager's cells
 * (`PUBLISH_ANNOTATION_SLOT`): for every entry of a protected type, how many
 * approvals its current version has against what the rule asks for — and,
 * when publishing is held, a `blocking` note, so the reader sees which
 * entries the commit will refuse before it refuses them.
 *
 * It decides nothing. The commit is content's bulk publish, whose publish
 * guard is this plugin's server half; a held entry the reader picks anyway is
 * refused there and reported as "held by a publish rule". An entry of an
 * unprotected type gets no note at all — "0/0" would be noise on every cell.
 *
 * One status read per type in the set (the records column's own endpoint),
 * keyed on `version` so the numbers are re-read after a commit.
 */
export function usePublishReviewAnnotations(
    entries: readonly PublishEntry[],
    context: PublishSlotContext
): PublishAnnotations | null {
    const intl = useIntl();
    const byType = new Map<string, string[]>();
    for (const entry of entries) {
        const ids = byType.get(entry.type) ?? [];
        ids.push(entry.id);
        byType.set(entry.type, ids);
    }
    const types = [...byType];
    const queries = useQueries({
        queries: types.map(([type, ids]) => ({
            queryKey: [
                ...reviewStatusKey(context.workspaceId, type, ids),
                context.version
            ],
            queryFn: () => statusFor(type, ids),
            refetchOnWindowFocus: false
        }))
    });
    if (types.length === 0) return null;

    const byEntry = new Map<string, PublishAnnotation>();
    for (const query of queries) {
        for (const [id, status] of Object.entries(query.data ?? {})) {
            if (!status.protected) continue;
            byEntry.set(
                id,
                status.blocked
                    ? {
                          label: intl.formatMessage(messages.held, {
                              given: status.given,
                              required: status.required
                          }),
                          tone: 'warning',
                          blocking: true,
                          description: intl.formatMessage(
                              status.requested
                                  ? messages.heldRequested
                                  : messages.heldUnrequested,
                              { required: status.required }
                          )
                      }
                    : {
                          label: intl.formatMessage(messages.approved),
                          tone: 'success',
                          description: intl.formatMessage(
                              messages.approvedDescription,
                              {
                                  given: status.given,
                                  required: status.required
                              }
                          )
                      }
            );
        }
    }
    return {
        byEntry,
        isPending: queries.some((query) => query.isPending),
        isError: queries.some((query) => query.isError),
        refetch: () => {
            for (const query of queries) void query.refetch();
        }
    };
}
