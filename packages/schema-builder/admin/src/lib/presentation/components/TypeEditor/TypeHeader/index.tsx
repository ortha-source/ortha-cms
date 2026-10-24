import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { FileText, Settings2, Table2 } from 'lucide-react';
import { Badge, Button, ContainerHeader } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import type { TypePatch } from '../../../../domain/schemaDraftAction';
import { TypeMenu } from '../TypeMenu';
import { TypeSettingsSheet } from '../TypeSettingsSheet';

const messages = defineMessages({
    collection: {
        id: 'schemaBuilder.type.kindCollection',
        defaultMessage: 'Collection'
    },
    single: { id: 'schemaBuilder.type.kindSingle', defaultMessage: 'Page' },
    publishable: {
        id: 'schemaBuilder.type.publishable',
        defaultMessage: 'Draft & publish'
    },
    paranoid: { id: 'schemaBuilder.type.trash', defaultMessage: 'Trash' },
    i18n: { id: 'schemaBuilder.type.i18n', defaultMessage: 'Localized' },
    fields: {
        id: 'schemaBuilder.type.fieldCount',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    },
    settings: { id: 'schemaBuilder.type.settings', defaultMessage: 'Settings' }
});

const FLAGS = ['publishable', 'paranoid', 'i18n'] as const;

type Props = {
    type: TypeDoc;
    /** Present when the type may be changed: its settings and removal. */
    editing?: {
        served: TypeDoc | undefined;
        onChange: (patch: TypePatch) => void;
        onRemove: () => void;
    };
};

/**
 * The open type as the page's `<h1>`, over one line of what you need to know
 * about it: machine name, kind, the flags that are on (as pills), path and
 * field count. Label, description and the flags themselves are edited in a
 * Settings sheet; the ⋯ holds removing the type.
 */
export function TypeHeader({ type, editing }: Props) {
    const intl = useIntl();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const Icon = type.kind === 'single' ? FileText : Table2;
    const dot = (
        <span aria-hidden className="text-muted-foreground/60">
            ·
        </span>
    );
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
                <ContainerHeader
                    className="mb-0 min-w-0 flex-1"
                    icon={<Icon className="size-4" />}
                    title={type.label || type.name}
                    subtitle={
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <span className="font-mono text-foreground/80">
                                {type.name}
                            </span>
                            {dot}
                            <span>
                                {intl.formatMessage(messages[type.kind])}
                            </span>
                            {type.kind === 'single' && type.path && (
                                <>
                                    {dot}
                                    <span className="font-mono">
                                        {type.path}
                                    </span>
                                </>
                            )}
                            {FLAGS.some((flag) => type[flag]) && dot}
                            {FLAGS.filter((flag) => type[flag]).map((flag) => (
                                <Badge
                                    key={flag}
                                    variant="muted"
                                    className="font-normal text-foreground/80"
                                >
                                    {intl.formatMessage(messages[flag])}
                                </Badge>
                            ))}
                            {dot}
                            <span>
                                {intl.formatMessage(messages.fields, {
                                    count: type.fields.length
                                })}
                            </span>
                        </span>
                    }
                />
                {editing && (
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <Button
                            variant="outline"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings2 />
                            {intl.formatMessage(messages.settings)}
                        </Button>
                        <TypeMenu type={type} onRemove={editing.onRemove} />
                    </div>
                )}
            </div>
            {type.description && (
                <p className="max-w-[640px] text-sm text-muted-foreground">
                    {type.description}
                </p>
            )}
            {editing && (
                <TypeSettingsSheet
                    type={type}
                    served={editing.served}
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    onChange={editing.onChange}
                />
            )}
        </div>
    );
}
