import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge, cn } from '@orthacms/design-system';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { fieldFacts } from '../../../../../domain/fieldFacts';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldFactList } from './FieldFactList';
import { FieldRowMenu } from './FieldRowMenu';
import { FieldTypeIcon } from '../../../FieldTypeIcon';

const messages = defineMessages({
    issues: {
        id: 'schemaBuilder.field.issues',
        defaultMessage: '{count, plural, one {# problem} other {# problems}}'
    },
    edit: { id: 'schemaBuilder.field.editName', defaultMessage: 'Edit {name}' }
});

type Props = {
    entry: FieldEntry;
    editing?: FieldListEditing;
    /** The drag handle, when the row is sortable. */
    handle?: ReactNode;
    className?: string;
};

/** One field: its type, machine name, label, what is notable about it, and its type in words. */
export function FieldRow({ entry, editing, handle, className }: Props) {
    const intl = useIntl();
    const label = entry.spec.admin?.label;
    const issues = editing?.issuesOf(entry.name) ?? 0;
    return (
        <div
            className={cn(
                'flex min-h-12 items-center gap-3 px-4 py-2',
                className
            )}
        >
            {handle}
            <FieldTypeIcon type={entry.spec.type} />
            <span className="flex min-w-0 flex-col">
                {editing ? (
                    <button
                        type="button"
                        className="rounded text-left font-mono text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={intl.formatMessage(messages.edit, {
                            name: entry.name
                        })}
                        onClick={() => editing.onEdit(entry.key)}
                    >
                        {entry.name}
                    </button>
                ) : (
                    <span className="font-mono text-sm">{entry.name}</span>
                )}
                {label && (
                    <span className="truncate text-xs text-muted-foreground">
                        {label}
                    </span>
                )}
            </span>
            <FieldFactList facts={fieldFacts(entry.spec)} />
            {issues > 0 && (
                <Badge
                    variant="destructive-soft"
                    className="shrink-0 gap-1 font-normal"
                >
                    <AlertTriangle className="size-3" aria-hidden />
                    {intl.formatMessage(messages.issues, { count: issues })}
                </Badge>
            )}
            <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
                {entry.spec.type}
            </Badge>
            {editing && (
                <FieldRowMenu
                    name={entry.name}
                    onEdit={() => editing.onEdit(entry.key)}
                    onRemove={() => editing.onRemove(entry.key)}
                />
            )}
        </div>
    );
}
