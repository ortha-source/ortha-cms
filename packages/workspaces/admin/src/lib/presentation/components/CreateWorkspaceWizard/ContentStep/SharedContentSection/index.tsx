import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { FileText, Layers } from 'lucide-react';
import { Checkbox, cn } from '@orthacms/design-system';
import { useSharedSourceCandidates } from '../../../../../application/useSharedSourceCandidates';
import type {
    ContentType,
    SharedContentChoice
} from '../../../../../domain/types/wizard';

const messages = defineMessages({
    heading: {
        id: 'workspaces.create.content.sharedHeading',
        defaultMessage: 'Shared content'
    },
    help: {
        id: 'workspaces.create.content.sharedHelp',
        defaultMessage:
            'Published records from shared workspaces. This workspace can view and link them, but not create its own through these grants.'
    },
    group: {
        id: 'workspaces.create.content.sharedGroup',
        defaultMessage: 'From {workspace}'
    },
    label: {
        id: 'workspaces.create.content.sharedLabel',
        defaultMessage: '{type} · {workspace}'
    },
    count: {
        id: 'workspaces.create.content.sharedCount',
        defaultMessage:
            '{count, plural, =0 {No shared content selected} one {# shared type selected} other {# shared types selected}}'
    }
});

/** Props for {@link SharedContentSection}. */
export type SharedContentSectionProps = {
    /** The content-type catalogue, for each type's label. */
    catalog: readonly ContentType[];
    /** The shared picks so far. */
    selected: readonly SharedContentChoice[];
    /** Pick or unpick one type from one shared workspace. */
    onToggle: (choice: SharedContentChoice) => void;
};

/**
 * The "Specific content" step's shared half: one group per shared workspace
 * ("From {workspace}"), each type a checkbox reading "{Type} · {Workspace}".
 * A pick is a grant of that source's records — separate from picking the same
 * type above as this workspace's own. Renders nothing when no shared workspace
 * offers anything: it is an addition to the step, not a state of it.
 */
export function SharedContentSection({
    catalog,
    selected,
    onToggle
}: SharedContentSectionProps) {
    const intl = useIntl();
    const headingId = useId();
    const { sources } = useSharedSourceCandidates();

    if (sources.length === 0) return null;

    const labelOf = (slug: string) =>
        catalog.find((type) => type.name === slug)?.label ?? slug;
    const isSelected = (choice: SharedContentChoice) =>
        selected.some(
            (c) =>
                c.slug === choice.slug &&
                c.sourceWorkspaceId === choice.sourceWorkspaceId
        );

    return (
        <section
            className="flex flex-col gap-3"
            aria-labelledby={`${headingId}-heading`}
        >
            <div className="flex flex-col gap-0.5">
                <h3 id={`${headingId}-heading`} className="text-sm font-medium">
                    {intl.formatMessage(messages.heading)}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.help)}
                </p>
            </div>

            {sources.map((source) => (
                <div
                    key={source.workspaceId}
                    role="group"
                    aria-labelledby={`${headingId}-${source.workspaceId}`}
                    className="flex flex-col gap-1.5"
                >
                    <h4
                        id={`${headingId}-${source.workspaceId}`}
                        className="text-xs font-medium text-muted-foreground"
                    >
                        {intl.formatMessage(messages.group, {
                            workspace: source.workspaceName
                        })}
                    </h4>
                    <ul className="flex flex-col rounded-lg border">
                        {source.content.map((type, index) => {
                            const choice = {
                                slug: type.slug,
                                sourceWorkspaceId: source.workspaceId
                            };
                            const Icon =
                                type.kind === 'single' ? FileText : Layers;
                            return (
                                <li key={type.slug}>
                                    <label
                                        className={cn(
                                            'flex cursor-pointer items-center gap-3 px-3 py-2',
                                            index > 0 && 'border-t'
                                        )}
                                    >
                                        <Checkbox
                                            checked={isSelected(choice)}
                                            onCheckedChange={() =>
                                                onToggle(choice)
                                            }
                                        />
                                        <Icon
                                            aria-hidden
                                            className="size-4 shrink-0 text-muted-foreground"
                                        />
                                        <span className="truncate text-sm font-medium">
                                            {intl.formatMessage(
                                                messages.label,
                                                {
                                                    type: labelOf(type.slug),
                                                    workspace:
                                                        source.workspaceName
                                                }
                                            )}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}

            <p className="text-xs text-muted-foreground">
                {intl.formatMessage(messages.count, {
                    count: selected.length
                })}
            </p>
        </section>
    );
}
