import { useMemo } from 'react';
import { useHasPermission } from '@orthacms/identity-admin';
import { resolveEntryAccess, type EntryAccess } from '../../domain/entryAccess';
import { useAccessRules } from '../useAccessRules';
import { useAssignments } from '../useAssignments';
import { useSegmentTypes } from '../useSegmentTypes';

/** What the chip and the tab read. */
export type UseEntryAccessResult = {
    /** The resolved chain, or `null` while the two queries are in flight. */
    access: EntryAccess | null;
    /**
     * Whether segmentation is configured at all. With no active type the whole
     * feature is inert — `planAccessPredicate` emits nothing and every read is
     * byte-for-byte what it was before — so the chip renders nothing rather
     * than an "Open to everyone" badge on an installation that has no notion of
     * access to begin with.
     */
    configured: boolean;
    /** Still loading. */
    isPending: boolean;
    /** Whether the caller may read any of this. */
    canRead: boolean;
};

/**
 * One entry's access, assembled from the three cached queries the workspace
 * already holds.
 *
 * The whole point is that it issues **no request of its own**. It is mounted by
 * the entry header's chip, which renders on every entry open in the library, so
 * a fetch here would be a request per entry — against three endpoints whose
 * answers do not change between entries. The lists are workspace-wide and
 * cached; this hook only does the join.
 */
export function useEntryAccess(input: {
    workspaceId: string;
    typeSlug: string;
    entryId?: string;
}): UseEntryAccessResult {
    const canRead = useHasPermission('access:read');
    const types = useSegmentTypes(canRead);
    const rules = useAccessRules(input.workspaceId, canRead);
    const assignments = useAssignments(input.workspaceId, canRead);

    const configured = (types.data ?? []).some(
        (type) => type.state === 'active'
    );

    const access = useMemo(() => {
        if (!rules.data || !assignments.data) return null;
        return resolveEntryAccess({
            assignments: assignments.data,
            rules: rules.data,
            typeSlug: input.typeSlug,
            entryId: input.entryId
        });
    }, [rules.data, assignments.data, input.typeSlug, input.entryId]);

    return {
        access,
        configured,
        isPending:
            canRead &&
            (types.isPending || rules.isPending || assignments.isPending),
        canRead
    };
}
