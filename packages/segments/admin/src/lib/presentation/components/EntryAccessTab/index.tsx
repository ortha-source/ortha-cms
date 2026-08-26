import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Globe, Lock, ShieldCheck } from 'lucide-react';
import { ChangedBadge, type EntryTabContext } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { Badge, Button, Skeleton } from '@orthacms/design-system';
import {
    isOpen,
    sameAccess,
    stateOf,
    withState,
    OPEN_ACCESS,
    type EntryAccessStaging
} from '../../../domain/types';
import {
    SEGMENTS_MANAGE,
    useSegments,
    useEntryAccess
} from '../../../application/hooks';
import { ENTRY_ACCESS_PRESAVE_ID } from '../../../application/useEntryAccessPresave';
import { SegmentStateControl } from '../SegmentStateControl';

const messages = defineMessages({
    heading: {
        id: 'segments.entryTab.heading',
        defaultMessage: 'Who can read this'
    },
    body: {
        id: 'segments.entryTab.body',
        defaultMessage:
            'Set each audience to “Can see” or “Cannot see”. Leave one unset and it follows the rest: with nothing set to “Can see”, everybody reads the entry; set one, and only the audiences you named do. “Cannot see” always wins.'
    },
    open: {
        id: 'segments.entryTab.open',
        defaultMessage: 'Readable by everyone'
    },
    restricted: {
        id: 'segments.entryTab.restricted',
        defaultMessage: 'Restricted'
    },
    pending: {
        id: 'segments.entryTab.pending',
        defaultMessage: 'Applied when you save the entry.'
    },
    readOnly: {
        id: 'segments.entryTab.readOnly',
        defaultMessage:
            'You can see who reads this, but changing it needs the “segments:manage” permission.'
    },
    noSegments: {
        id: 'segments.entryTab.noSegments',
        defaultMessage:
            'No audiences yet. Create one under Segments, then come back to choose who reads this entry.'
    },
    manage: { id: 'segments.entryTab.manage', defaultMessage: 'Segments' },
    tags: { id: 'segments.entryTab.tags', defaultMessage: 'Tags: {tags}' }
});

/**
 * The entry editor's **Access** tab — the whole feature, from an editor's side.
 *
 * One row per audience, each with the three-state control. There is nothing else
 * on this tab because there is nothing else in the model: no rule to pick, no
 * level to inherit from, no window. What is set here is what a reader is matched
 * against on the next request.
 *
 * **It has no Save button, on purpose.** Who may read a record is part of the
 * record, so it rides the editor's own Save / Publish like a field does —
 * staged here, written by the presave step when the entry is written. A second
 * Save on a tab of the editor asks the user to remember which of two buttons
 * their change belonged to, and publishes intermediate answers to real readers
 * on the way to the one they meant.
 *
 * The staging lives **above this component** ({@link EntryAccessStaging}, reached
 * through `presave`) because editor tabs are routes: this panel unmounts the
 * moment the user switches tab, and an unsaved decision must not go with it.
 */
export function EntryAccessTab({
    workspaceId,
    entry,
    readOnly,
    presave
}: EntryTabContext) {
    const intl = useIntl();
    // Two gates, and they are not the same one. `readOnly` says the caller may
    // not edit this entry's *values*; `segments:manage` says they may not
    // change who reads it. An editor with `content:update` and neither should
    // be able to rewrite the article and not to publish it to a new audience.
    const canManage = useHasPermission(SEGMENTS_MANAGE);
    const segments = useSegments();
    const saved = useEntryAccess(workspaceId, entry?.id, entry?.updatedAt);
    const staging = presave[ENTRY_ACCESS_PRESAVE_ID] as
        | EntryAccessStaging
        | undefined;

    // What the entry is set to now, and what the next save will make of it. On a
    // create there is nothing saved to read, so the base is open access — which
    // is what an entry that nobody has restricted is.
    const savedAccess = saved.data ?? OPEN_ACCESS;
    const draft = staging?.draft ?? savedAccess;
    const dirty = Boolean(staging?.draft);

    // The read is disabled without an entry id, so it never resolves on a create
    // — waiting on it there would leave the tab on skeletons forever.
    if (segments.isPending || (entry && saved.isPending)) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    const list = segments.data ?? [];
    if (!list.length) {
        return (
            <div className="flex flex-col items-start gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noSegments)}
                </p>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/segments">
                        <ShieldCheck aria-hidden />
                        {intl.formatMessage(messages.manage)}
                    </Link>
                </Button>
            </div>
        );
    }

    const locked = readOnly || !canManage || !staging;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        {intl.formatMessage(messages.heading)}
                        <Badge
                            variant={isOpen(draft) ? 'secondary' : 'warning'}
                        >
                            {isOpen(draft) ? (
                                <Globe className="size-3" aria-hidden />
                            ) : (
                                <Lock className="size-3" aria-hidden />
                            )}
                            {intl.formatMessage(
                                isOpen(draft)
                                    ? messages.open
                                    : messages.restricted
                            )}
                        </Badge>
                        {dirty ? <ChangedBadge /> : null}
                    </h3>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                        {intl.formatMessage(messages.body)}
                    </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/segments">
                        <ShieldCheck aria-hidden />
                        {intl.formatMessage(messages.manage)}
                    </Link>
                </Button>
            </div>

            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
                {list.map((segment) => (
                    <li
                        key={segment.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                        <div className="min-w-0">
                            <span className="text-sm font-medium">
                                {segment.label}
                            </span>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {intl.formatMessage(messages.tags, {
                                    tags: segment.tags.join(', ') || segment.key
                                })}
                            </p>
                        </div>
                        <SegmentStateControl
                            name={segment.label}
                            value={stateOf(draft, segment.id)}
                            disabled={locked}
                            onChange={(state) => {
                                const next = withState(
                                    draft,
                                    segment.id,
                                    state
                                );
                                // Staging what is already stored would light the
                                // Changed badge and cost a write for a round
                                // trip back to where the entry started.
                                staging?.stage(
                                    sameAccess(next, savedAccess) ? null : next
                                );
                            }}
                        />
                    </li>
                ))}
            </ul>

            <p className="text-xs text-muted-foreground">
                {intl.formatMessage(
                    locked ? messages.readOnly : messages.pending
                )}
            </p>
        </div>
    );
}
