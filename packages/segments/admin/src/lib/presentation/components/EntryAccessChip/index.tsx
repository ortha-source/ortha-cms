import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Globe, Lock } from 'lucide-react';
import { ENTRY_MODE, type EntrySlotContext } from '@orthacms/content-admin';
import {
    Badge,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Skeleton
} from '@orthacms/design-system';
import { useEntryAccess } from '../../../application/useEntryAccess';
import { EntryAccessChain } from '../EntryAccessChain';

const messages = defineMessages({
    restricted: {
        id: 'segments.entryChip.restricted',
        defaultMessage: 'Restricted'
    },
    open: { id: 'segments.entryChip.open', defaultMessage: 'Open to everyone' },
    trigger: {
        id: 'segments.entryChip.trigger',
        defaultMessage: 'Who can read this entry'
    },
    openBody: {
        id: 'segments.entryChip.openBody',
        defaultMessage:
            'No rule applies to this entry, its collection, or this workspace, so every reader of your content API sees it once it is published.'
    },
    manage: {
        id: 'segments.entryChip.manage',
        defaultMessage: 'Open the Access tab'
    }
});

/**
 * The entry header's access chip — the one always-visible answer to "who can
 * read this".
 *
 * It lives in the **header**, beside the title, rather than in the properties
 * rail. The rail is where an editor looks when they already have a question;
 * the header is what they see while writing, and the moment access matters is
 * the moment before they publish something they believe is public. Its popover
 * carries the *chain* — which levels contributed — because "restricted" without
 * "by the collection's rule" sends people looking in the wrong place.
 *
 * It renders **nothing** when no segment type is active. With no axis the whole
 * feature is inert, and a chip saying "Open to everyone" on an installation
 * that has no notion of access is a claim about a system that is not running.
 */
export function EntryAccessChip({
    workspaceId,
    schema,
    entry,
    mode,
    typePath
}: EntrySlotContext) {
    const intl = useIntl();
    const { access, configured, isPending, canRead } = useEntryAccess({
        workspaceId,
        typeSlug: schema.name,
        entryId: entry?.id
    });

    if (!canRead || (!isPending && !configured)) {
        return null;
    }

    if (isPending || !access) {
        return <Skeleton className="h-5 w-24 rounded-full" />;
    }

    const restricted = access.restricted;
    // Spelled out rather than a relative `to="access"`: a **single** page's
    // editor is mounted on the type itself, so its tabs are static segments
    // under `typePath`, while a collection row nests them under the entry id.
    // Relative resolution differs between the two and would send one of them to
    // a route that does not exist.
    const tabPath =
        mode === ENTRY_MODE.Single
            ? `${typePath}/access`
            : entry
              ? `${typePath}/${entry.id}/access`
              : null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={intl.formatMessage(messages.trigger)}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Badge variant={restricted ? 'warning' : 'secondary'}>
                        {restricted ? (
                            <Lock className="size-3" aria-hidden />
                        ) : (
                            <Globe className="size-3" aria-hidden />
                        )}
                        {intl.formatMessage(
                            restricted ? messages.restricted : messages.open
                        )}
                    </Badge>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
                {restricted ? (
                    <EntryAccessChain access={access} />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.openBody)}
                    </p>
                )}
                {tabPath ? (
                    <Link
                        to={tabPath}
                        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                        {intl.formatMessage(messages.manage)}
                    </Link>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
