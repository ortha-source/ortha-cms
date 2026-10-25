import { useId, type ComponentType } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Badge, Checkbox, cn } from '@orthacms/design-system';
import { useResourceSelection } from '../../../../../hooks/useResourceSelection';
import type {
    ContentType,
    ResourceSelection
} from '../../../../../../domain/types/wizard';
import { PickerHeader } from '../PickerHeader';

const messages = defineMessages({
    ofTotal: {
        id: 'workspaces.create.content.ofTotal',
        defaultMessage: '{count} of {total}'
    },
    elsewhere: {
        id: 'workspaces.create.content.elsewhere',
        defaultMessage:
            '{count, plural, one {# record elsewhere} other {# records elsewhere}}'
    },
    unused: {
        id: 'workspaces.create.content.unused',
        defaultMessage: 'new'
    },
    unusedTitle: {
        id: 'workspaces.create.content.unusedTitle',
        defaultMessage: 'None of your workspaces uses it yet'
    }
});

/** Props for {@link OwnTypeSection}. */
export type OwnTypeSectionProps = {
    /** The kicker ("Collections" / "Pages"). */
    title: string;
    /** The row icon. */
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    /** The content types of this kind. */
    types: readonly ContentType[];
    /** The selection of this kind. */
    selection: ResourceSelection;
    /** Replace the selection. */
    onChange: (next: ResourceSelection) => void;
    /** Records of each type across your other workspaces. */
    elsewhere: Readonly<Record<string, number>>;
    /** Types none of your workspaces is granted. */
    unused: ReadonlySet<string>;
};

/**
 * One kind of this workspace's own content types in the picker — a labelled
 * group with "N of M" in its header, and a checkbox row per type saying how
 * many records it already holds in your other workspaces, or that none of
 * them uses it yet.
 */
export function OwnTypeSection({
    title,
    icon: Icon,
    types,
    selection,
    onChange,
    elsewhere,
    unused
}: OwnTypeSectionProps) {
    const intl = useIntl();
    const headingId = useId();
    const controller = useResourceSelection(selection, onChange, types.length);
    if (types.length === 0) return null;

    return (
        <div role="group" aria-labelledby={headingId}>
            <PickerHeader
                id={headingId}
                title={title}
                note={intl.formatMessage(messages.ofTotal, {
                    count: controller.count,
                    total: types.length
                })}
            />
            <ul>
                {types.map((type) => {
                    const checked = controller.isSelected(type.name);
                    const records = elsewhere[type.name] ?? 0;
                    return (
                        <li key={type.name} className="border-b">
                            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={() =>
                                        controller.toggle(type.name)
                                    }
                                    // Named for the type alone; the usage
                                    // hint beside it is not part of the name.
                                    aria-label={type.label ?? type.name}
                                />
                                <Icon
                                    aria-hidden
                                    className="size-4 shrink-0 text-muted-foreground"
                                />
                                <span
                                    className={cn(
                                        'truncate text-sm',
                                        checked && 'font-medium'
                                    )}
                                >
                                    {type.label ?? type.name}
                                </span>
                                {records > 0 ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.elsewhere,
                                            { count: records }
                                        )}
                                    </span>
                                ) : unused.has(type.name) ? (
                                    <Badge
                                        variant="info"
                                        size="xs"
                                        title={intl.formatMessage(
                                            messages.unusedTitle
                                        )}
                                    >
                                        {intl.formatMessage(messages.unused)}
                                    </Badge>
                                ) : null}
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
