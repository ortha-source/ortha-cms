import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Globe, Lock, ShieldCheck } from 'lucide-react';
import type { EntryTabContext } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    Badge,
    Button,
    Skeleton,
    Spinner,
    toast
} from '@orthacms/design-system';
import {
    isOpen,
    sameAccess,
    stateOf,
    withState,
    OPEN_ACCESS,
    type EntryAccess
} from '../../../domain/types';
import {
    SEGMENTS_MANAGE,
    useEntryAccess,
    useSegments,
    useSetEntryAccess
} from '../../../application/hooks';
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
    save: { id: 'segments.entryTab.save', defaultMessage: 'Save access' },
    reset: { id: 'segments.entryTab.reset', defaultMessage: 'Undo' },
    saved: {
        id: 'segments.entryTab.saved',
        defaultMessage: 'Saved — readers are being served the new answer'
    },
    error: {
        id: 'segments.entryTab.error',
        defaultMessage: 'Couldn’t save that. Please try again.'
    },
    unsaved: {
        id: 'segments.entryTab.unsaved',
        defaultMessage:
            'Save the entry first — access attaches to an entry that exists.'
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
 * One row per audience, each with the three-state control. There is nothing
 * else on this tab because there is nothing else in the model: no rule to pick,
 * no level to inherit from, no window. What is set here is what a reader is
 * matched against on the next request.
 *
 * **The draft is local until Save.** Each toggle is a small change and the set
 * of them is one decision — "these three see it, that one does not" — so
 * writing on every click would publish four intermediate answers to real
 * readers on the way to the intended one.
 */
export function EntryAccessTab({
    workspaceId,
    schema,
    entry,
    readOnly
}: EntryTabContext) {
    const intl = useIntl();
    // Two gates, and they are not the same one. `readOnly` says the caller may
    // not edit this entry's *values*; `segments:manage` says they may not
    // change who reads it. An editor with `content:update` and neither should
    // be able to rewrite the article and not to publish it to a new audience.
    const canManage = useHasPermission(SEGMENTS_MANAGE);
    const segments = useSegments();
    const saved = useEntryAccess(workspaceId, entry?.id);
    const save = useSetEntryAccess(workspaceId);

    const [draft, setDraft] = useState<EntryAccess>(OPEN_ACCESS);

    // Re-seed whenever the server's answer changes — the first load, and after
    // a save lands. Keyed on the value rather than a ref so a change made in
    // another tab is picked up rather than silently overwritten.
    const savedAccess = saved.data;
    useEffect(() => {
        if (savedAccess) setDraft(savedAccess);
    }, [savedAccess]);

    const dirty = useMemo(
        () =>
            Boolean(savedAccess) &&
            !sameAccess(draft, savedAccess as EntryAccess),
        [draft, savedAccess]
    );

    if (!entry) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.unsaved)}
            </p>
        );
    }

    if (segments.isPending || saved.isPending) {
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

    const locked = readOnly || !canManage;

    const submit = () => {
        save.mutate(
            {
                entryId: entry.id,
                typeSlug: schema.name,
                allow: draft.allow,
                deny: draft.deny
            },
            {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.saved)),
                onError: () => toast.error(intl.formatMessage(messages.error))
            }
        );
    };

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
                            disabled={locked || save.isPending}
                            onChange={(state) =>
                                setDraft((current) =>
                                    withState(current, segment.id, state)
                                )
                            }
                        />
                    </li>
                ))}
            </ul>

            {locked ? (
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.readOnly)}
                </p>
            ) : (
                <div className="flex items-center gap-2">
                    <Button
                        onClick={submit}
                        disabled={!dirty || save.isPending}
                    >
                        {save.isPending ? <Spinner /> : null}
                        {intl.formatMessage(messages.save)}
                    </Button>
                    <Button
                        variant="ghost"
                        disabled={!dirty || save.isPending}
                        onClick={() => setDraft(savedAccess ?? OPEN_ACCESS)}
                    >
                        {intl.formatMessage(messages.reset)}
                    </Button>
                </div>
            )}
        </div>
    );
}
