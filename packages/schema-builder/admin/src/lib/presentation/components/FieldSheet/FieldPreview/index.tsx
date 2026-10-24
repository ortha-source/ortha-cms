import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Bold,
    Calendar,
    ChevronDown,
    Globe,
    ImagePlus,
    Italic,
    Link2,
    List,
    Plus
} from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { kindOf } from '../../../../domain/fieldCatalog';
import { toLabel } from '../../../../domain/identifiers';

const messages = defineMessages({
    heading: {
        id: 'schemaBuilder.preview.heading',
        defaultMessage: 'Preview — how editors see it'
    },
    yes: { id: 'schemaBuilder.preview.yes', defaultMessage: 'Yes' },
    no: { id: 'schemaBuilder.preview.no', defaultMessage: 'No' },
    pick: { id: 'schemaBuilder.preview.pick', defaultMessage: 'Pick one' },
    link: {
        id: 'schemaBuilder.preview.link',
        defaultMessage: 'Add {target}'
    },
    media: {
        id: 'schemaBuilder.preview.media',
        defaultMessage: 'Select or upload'
    },
    date: { id: 'schemaBuilder.preview.date', defaultMessage: 'Pick a date' },
    hidden: {
        id: 'schemaBuilder.preview.hidden',
        defaultMessage: 'Hidden from the form — editors do not see it.'
    }
});

/** A box drawn like an input, holding a placeholder or a value. */
function Box({
    children,
    tall,
    className
}: {
    children?: ReactNode;
    tall?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground',
                tall ? 'min-h-20 items-start py-2' : 'h-9',
                className
            )}
        >
            {children}
        </div>
    );
}

/**
 * The field as an editor will meet it in the entry form — label, required
 * mark, locale globe, the control its kind draws, placeholder and help text
 * — redrawn from the spec on every keystroke. A drawing, not a form: the
 * real controls are below, so this one is hidden from assistive tech and
 * takes no focus.
 */
export function FieldPreview({ entry }: { entry: FieldEntry }) {
    const intl = useIntl();
    const spec = entry.spec;
    const admin = spec.admin ?? {};
    const label = admin.label || (entry.name ? toLabel(entry.name) : '…');
    const placeholder = admin.placeholder ?? '';
    const kind = kindOf(spec);

    const control = (() => {
        switch (kind) {
            case 'longtext':
            case 'json':
                return (
                    <Box tall className={kind === 'json' ? 'font-mono' : ''}>
                        {placeholder || (kind === 'json' ? '{ }' : '')}
                    </Box>
                );
            case 'richtext':
                return (
                    <div className="rounded-md border bg-background">
                        <div className="flex items-center gap-3 border-b px-3 py-1.5 text-muted-foreground">
                            <Bold className="size-3.5" />
                            <Italic className="size-3.5" />
                            <List className="size-3.5" />
                            <Link2 className="size-3.5" />
                        </div>
                        <div className="min-h-16 px-3 py-2 text-sm text-muted-foreground">
                            {placeholder}
                        </div>
                    </div>
                );
            case 'boolean':
                return (
                    <div className="inline-flex h-9 rounded-md bg-muted p-0.5 text-sm">
                        <span className="rounded px-3 py-1 text-muted-foreground">
                            {intl.formatMessage(messages.no)}
                        </span>
                        <span className="rounded bg-background px-3 py-1 shadow-xs">
                            {intl.formatMessage(messages.yes)}
                        </span>
                    </div>
                );
            case 'date':
            case 'datetime':
                return (
                    <Box>
                        <Calendar className="size-4" />
                        {placeholder || intl.formatMessage(messages.date)}
                    </Box>
                );
            case 'select':
                return (
                    <Box className="justify-between">
                        {spec.type === 'select' && spec.defaultValue
                            ? spec.defaultValue
                            : placeholder || intl.formatMessage(messages.pick)}
                        <ChevronDown className="size-4" />
                    </Box>
                );
            case 'multiselect':
                return (
                    <Box className="justify-between">
                        <span className="flex gap-1">
                            {(spec.type === 'multiselect' ? spec.options : [])
                                .slice(0, 3)
                                .map((option) => (
                                    <span
                                        key={option}
                                        className="rounded border bg-muted px-1.5 text-xs text-foreground"
                                    >
                                        {option}
                                    </span>
                                ))}
                        </span>
                        <ChevronDown className="size-4" />
                    </Box>
                );
            case 'relation':
                return (
                    <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                        <Plus className="size-4" />
                        {intl.formatMessage(messages.link, {
                            target: spec.type === 'relation' ? spec.to : ''
                        })}
                    </div>
                );
            case 'media':
                return (
                    <div className="flex h-16 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
                        <ImagePlus className="size-4" />
                        {intl.formatMessage(messages.media)}
                    </div>
                );
            default:
                return (
                    <Box
                        className={
                            kind === 'number' || kind === 'money'
                                ? 'tabular-nums'
                                : undefined
                        }
                    >
                        {(spec.type === 'text' ||
                            spec.type === 'number' ||
                            spec.type === 'money') &&
                        spec.defaultValue !== undefined
                            ? String(spec.defaultValue)
                            : placeholder}
                    </Box>
                );
        }
    })();

    return (
        <section
            aria-labelledby="field-preview-heading"
            className="rounded-lg border border-dashed bg-muted/30 p-3.5"
        >
            <h3
                id="field-preview-heading"
                className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
                {intl.formatMessage(messages.heading)}
            </h3>
            {admin.hidden ? (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.hidden)}
                </p>
            ) : (
                <div aria-hidden className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1 text-sm font-medium">
                        {label}
                        {spec.required && (
                            <span className="text-destructive">*</span>
                        )}
                        {spec.localized && (
                            <Globe className="ml-1 size-3.5 text-muted-foreground" />
                        )}
                    </div>
                    {control}
                    {admin.description && (
                        <p className="text-xs text-muted-foreground">
                            {admin.description}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
