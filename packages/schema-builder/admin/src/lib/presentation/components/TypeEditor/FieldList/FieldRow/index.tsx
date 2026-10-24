import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge, cn } from '@orthacms/design-system';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { kindOf } from '../../../../../domain/fieldCatalog';
import { fieldFacts } from '../../../../../domain/fieldFacts';
import { toLabel } from '../../../../../domain/identifiers';
import { kindCopy } from '../../../fieldKindCopy';
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

/**
 * One field as people read it: the label leads, the machine name sits under
 * it in mono; badges only for what changes behaviour (Required, Localized,
 * Hidden, Multiple); the type in words on the right, with the detail that
 * matters for it (how many options, which type a relation points at).
 */
export function FieldRow({ entry, editing, handle, className }: Props) {
    const intl = useIntl();
    const label = entry.spec.admin?.label || toLabel(entry.name);
    const issues = editing?.issuesOf(entry.name) ?? 0;
    const facts = fieldFacts(entry.spec);
    return (
        <div
            className={cn(
                'flex min-h-[3.25rem] items-center gap-3 px-4 py-2',
                className
            )}
        >
            {handle}
            <FieldTypeIcon type={entry.spec.type} />
            <span className="flex min-w-0 flex-col">
                {editing ? (
                    <button
                        type="button"
                        className="truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={intl.formatMessage(messages.edit, {
                            name: entry.name
                        })}
                        onClick={() => editing.onEdit(entry.key)}
                    >
                        {label}
                    </button>
                ) : (
                    <span className="truncate text-sm font-medium">
                        {label}
                    </span>
                )}
                <span className="truncate font-mono text-xs text-muted-foreground">
                    {entry.name}
                </span>
            </span>
            <FieldFactList facts={facts} part="flags" />
            {issues > 0 && (
                <Badge
                    variant="destructive-soft"
                    className="shrink-0 gap-1 font-normal"
                >
                    <AlertTriangle className="size-3" aria-hidden />
                    {intl.formatMessage(messages.issues, { count: issues })}
                </Badge>
            )}
            <span className="ml-auto flex min-w-0 shrink-0 items-center gap-1 text-right text-xs text-muted-foreground">
                <span>
                    {intl.formatMessage(kindCopy(kindOf(entry.spec)).label)}
                </span>
                <FieldFactList facts={facts} part="details" />
            </span>
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
