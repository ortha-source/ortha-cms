import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { initialsOf } from '@orthacms/utils-admin';
import { Checkbox, cn, type AvatarColor } from '@orthacms/design-system';
import type { SharedSource } from '../../../../../../domain/types/workspace';
import type {
    ContentType,
    SharedContentChoice
} from '../../../../../../domain/types/wizard';
import { WorkspaceAvatar } from '../../../../WorkspaceAvatar';
import { PickerHeader } from '../PickerHeader';

const messages = defineMessages({
    heading: {
        id: 'workspaces.create.content.sharedHeading',
        defaultMessage: 'From shared workspaces'
    },
    note: {
        id: 'workspaces.create.content.sharedNote',
        defaultMessage: 'read-only, published records'
    },
    from: {
        id: 'workspaces.create.content.sharedFrom',
        defaultMessage: 'from {workspace}'
    }
});

/** Props for {@link SharedTypeSection}. */
export type SharedTypeSectionProps = {
    /** The shared workspaces and the types each offers. */
    sources: readonly SharedSource[];
    /** Each source's accent colour, by workspace id. */
    colors: Readonly<Record<string, AvatarColor>>;
    /** The content-type catalogue, for labels. */
    catalog: readonly ContentType[];
    /** The shared picks so far. */
    selected: readonly SharedContentChoice[];
    /** Pick or unpick one type from one source. */
    onToggle: (choice: SharedContentChoice) => void;
};

/**
 * What shared workspaces offer, in the same list as this workspace's own
 * types: one row per (type, source) — "Authors from Marketing site" — each a
 * grant to read and link that source's published records, never to write
 * them. Renders nothing when no shared workspace offers anything.
 */
export function SharedTypeSection({
    sources,
    colors,
    catalog,
    selected,
    onToggle
}: SharedTypeSectionProps) {
    const intl = useIntl();
    const headingId = useId();
    if (sources.length === 0) return null;

    const labelOf = (slug: string) =>
        catalog.find((type) => type.name === slug)?.label ?? slug;
    const isSelected = (choice: SharedContentChoice) =>
        selected.some(
            (c) =>
                c.slug === choice.slug &&
                c.sourceWorkspaceId === choice.sourceWorkspaceId
        );
    const nameOf = (slug: string, workspace: string) =>
        `${labelOf(slug)} ${intl.formatMessage(messages.from, { workspace })}`;

    return (
        <div role="group" aria-labelledby={headingId}>
            <PickerHeader
                id={headingId}
                title={intl.formatMessage(messages.heading)}
                note={intl.formatMessage(messages.note)}
            />
            <ul>
                {sources.flatMap((source) =>
                    source.content.map((type) => {
                        const choice = {
                            slug: type.slug,
                            sourceWorkspaceId: source.workspaceId
                        };
                        const checked = isSelected(choice);
                        return (
                            <li
                                key={`${source.workspaceId}:${type.slug}`}
                                className="border-b"
                            >
                                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => onToggle(choice)}
                                        aria-label={nameOf(
                                            type.slug,
                                            source.workspaceName
                                        )}
                                    />
                                    <span aria-hidden>
                                        <WorkspaceAvatar
                                            initials={initialsOf(
                                                source.workspaceName
                                            )}
                                            color={
                                                colors[source.workspaceId] ??
                                                'slate'
                                            }
                                            className="size-5 rounded-[5px] text-[9px]"
                                        />
                                    </span>
                                    <span
                                        className={cn(
                                            'truncate text-sm',
                                            checked && 'font-medium'
                                        )}
                                    >
                                        {labelOf(type.slug)}{' '}
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {intl.formatMessage(messages.from, {
                                                workspace: source.workspaceName
                                            })}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );
}
