import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';
import { restrictsAnyone } from '../../../domain/types/accessRule';
import type { EntryAccess } from '../../../domain/entryAccess';

const messages = defineMessages({
    heading: {
        id: 'segments.chain.heading',
        defaultMessage: 'What applies here'
    },
    workspace: {
        id: 'segments.chain.workspace',
        defaultMessage: 'From this workspace'
    },
    type: {
        id: 'segments.chain.type',
        defaultMessage: 'From the collection'
    },
    entry: { id: 'segments.chain.entry', defaultMessage: 'On this entry' },
    merged: {
        id: 'segments.chain.merged',
        defaultMessage:
            'Every level applies at once — a reader has to satisfy all of them.'
    },
    unknown: {
        id: 'segments.chain.unknown',
        defaultMessage: 'Rule details not loaded'
    },
    open: {
        id: 'segments.chain.open',
        defaultMessage: 'Admits everyone'
    }
});

/** Props for {@link EntryAccessChain}. */
type EntryAccessChainProps = {
    /** The resolved chain. */
    access: EntryAccess;
};

/**
 * The inheritance chain that governs one entry, least specific first.
 *
 * Shared by the header chip's popover and the Access tab, because the two must
 * not tell different stories about the same entry. It reports **which levels
 * contributed**, not the decision — the decision is a reader's, and answering it
 * here would be a second implementation of the kernel that nobody tested against
 * an actual request.
 */
export function EntryAccessChain({ access }: EntryAccessChainProps) {
    const intl = useIntl();

    const levelLabel = (kind: 'workspace' | 'type' | 'entry') =>
        kind === 'workspace'
            ? intl.formatMessage(messages.workspace)
            : kind === 'type'
              ? intl.formatMessage(messages.type)
              : intl.formatMessage(messages.entry);

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
                {intl.formatMessage(messages.heading)}
            </h3>
            <ul className="flex flex-col gap-2">
                {access.levels.map((level) => (
                    <li
                        key={level.assignment.id}
                        className="flex items-start justify-between gap-3 text-sm"
                    >
                        <span className="font-medium">
                            {level.rule?.label ??
                                intl.formatMessage(messages.unknown)}
                            {level.rule && !restrictsAnyone(level.rule) ? (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {intl.formatMessage(messages.open)}
                                </span>
                            ) : null}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                            {levelLabel(level.kind)}
                        </Badge>
                    </li>
                ))}
            </ul>
            {access.levels.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.merged)}
                </p>
            ) : null}
        </div>
    );
}
