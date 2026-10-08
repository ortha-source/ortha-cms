import { defineMessages, useIntl } from 'react-intl';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button, cn, InputField } from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import { SwitchField } from '../../FieldSheet/SwitchField';

const messages = defineMessages({
    label: { id: 'schemaBuilder.groups.label', defaultMessage: 'Title' },
    description: {
        id: 'schemaBuilder.groups.description',
        defaultMessage: 'Description'
    },
    collapsed: {
        id: 'schemaBuilder.groups.collapsed',
        defaultMessage: 'Starts folded'
    },
    up: { id: 'schemaBuilder.groups.up', defaultMessage: 'Move {label} up' },
    down: {
        id: 'schemaBuilder.groups.down',
        defaultMessage: 'Move {label} down'
    },
    remove: {
        id: 'schemaBuilder.groups.remove',
        defaultMessage: 'Remove {label}'
    },
    count: {
        id: 'schemaBuilder.groups.count',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    },
    empty: {
        id: 'schemaBuilder.groups.empty',
        defaultMessage:
            'No fields yet — the schema refuses an empty group. Drag a field into it, or pick it on a field’s Display tab.'
    }
});

type Props = {
    group: GroupDoc;
    fields: number;
    first: boolean;
    last: boolean;
    onChange: (group: GroupDoc) => void;
    onMove: (step: -1 | 1) => void;
    onRemove: () => void;
};

/** One group: title, description, folded or not, its place in the order. An empty one is flagged. */
export function GroupCard({
    group,
    fields,
    first,
    last,
    onChange,
    onMove,
    onRemove
}: Props) {
    const intl = useIntl();
    const id = `group-${group.key}`;
    return (
        <li
            className={cn(
                'flex flex-col gap-3 rounded-lg border p-3',
                fields === 0 && 'border-amber-400'
            )}
        >
            <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                    {group.key}
                </span>
                <span className="text-xs text-muted-foreground">
                    · {intl.formatMessage(messages.count, { count: fields })}
                </span>
                <span className="ml-auto flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={first}
                        aria-label={intl.formatMessage(messages.up, {
                            label: group.label
                        })}
                        onClick={() => onMove(-1)}
                    >
                        <ArrowUp />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={last}
                        aria-label={intl.formatMessage(messages.down, {
                            label: group.label
                        })}
                        onClick={() => onMove(1)}
                    >
                        <ArrowDown />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        aria-label={intl.formatMessage(messages.remove, {
                            label: group.label
                        })}
                        onClick={onRemove}
                    >
                        <Trash2 />
                    </Button>
                </span>
            </div>
            <InputField
                id={`${id}-label`}
                label={intl.formatMessage(messages.label)}
                value={group.label}
                onChange={(event) =>
                    onChange({ ...group, label: event.target.value })
                }
            />
            <InputField
                id={`${id}-description`}
                label={intl.formatMessage(messages.description)}
                value={group.description ?? ''}
                onChange={(event) =>
                    onChange({
                        ...group,
                        description: event.target.value || undefined
                    })
                }
            />
            <SwitchField
                id={`${id}-collapsed`}
                label={intl.formatMessage(messages.collapsed)}
                checked={Boolean(group.collapsed)}
                onChange={(collapsed) =>
                    onChange({ ...group, collapsed: collapsed || undefined })
                }
            />
            {fields === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                    {intl.formatMessage(messages.empty)}
                </p>
            )}
        </li>
    );
}
