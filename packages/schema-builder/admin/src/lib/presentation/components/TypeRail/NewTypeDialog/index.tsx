import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { FileText, Lock, Table2 } from 'lucide-react';
import {
    Button,
    Checkbox,
    cn,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputField,
    Label
} from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { toTypeName } from '../../../../domain/identifiers';
import type { NewTypeOptions } from '../../../../domain/newTypeDoc';
import {
    TYPE_TEMPLATES,
    type TypeTemplate
} from '../../../../domain/typeTemplates';
import { KindCard } from './KindCard';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.newType.title',
        defaultMessage: 'New content type'
    },
    description: {
        id: 'schemaBuilder.newType.intro',
        defaultMessage:
            'Name it, pick its kind, and start blank or from a template. It joins your draft; nothing is created until you apply.'
    },
    label: { id: 'schemaBuilder.newType.label', defaultMessage: 'Name' },
    name: { id: 'schemaBuilder.newType.name', defaultMessage: 'Machine name' },
    nameTaken: {
        id: 'schemaBuilder.newType.nameTaken',
        defaultMessage: 'A type with this name exists.'
    },
    nameInvalid: {
        id: 'schemaBuilder.newType.nameInvalid',
        defaultMessage: 'Start with a letter; use a–z, 0–9 and _.'
    },
    kind: { id: 'schemaBuilder.newType.kind', defaultMessage: 'Kind' },
    collection: {
        id: 'schemaBuilder.newType.collection',
        defaultMessage: 'Collection'
    },
    collectionExample: {
        id: 'schemaBuilder.newType.collectionExample',
        defaultMessage: 'Many entries — articles, products, events.'
    },
    single: { id: 'schemaBuilder.newType.single', defaultMessage: 'Page' },
    singleExample: {
        id: 'schemaBuilder.newType.singleExample',
        defaultMessage: 'One entry — the home page, site settings.'
    },
    startFrom: {
        id: 'schemaBuilder.newType.startFrom',
        defaultMessage: 'Start from'
    },
    blank: { id: 'schemaBuilder.newType.blank', defaultMessage: 'Blank' },
    article: {
        id: 'schemaBuilder.newType.article',
        defaultMessage: 'Article'
    },
    event: { id: 'schemaBuilder.newType.event', defaultMessage: 'Event' },
    faq: { id: 'schemaBuilder.newType.faq', defaultMessage: 'FAQ' },
    features: {
        id: 'schemaBuilder.newType.features',
        defaultMessage: 'Features'
    },
    publishable: {
        id: 'schemaBuilder.type.publishable',
        defaultMessage: 'Draft & publish'
    },
    publishableHint: {
        id: 'schemaBuilder.newType.publishableHint',
        defaultMessage: 'Edits stay drafts until published.'
    },
    paranoid: { id: 'schemaBuilder.type.trash', defaultMessage: 'Trash' },
    paranoidHint: {
        id: 'schemaBuilder.newType.paranoidHint',
        defaultMessage: 'Deleted entries go to a trash and can be restored.'
    },
    i18n: { id: 'schemaBuilder.type.i18n', defaultMessage: 'Localized' },
    i18nHint: {
        id: 'schemaBuilder.newType.i18nHint',
        defaultMessage: 'Entries in several languages.'
    },
    fixed: {
        id: 'schemaBuilder.newType.fixed',
        defaultMessage:
            'Kind, machine name and features are fixed once applied — changing them later needs a data migration.'
    },
    create: {
        id: 'schemaBuilder.newType.create',
        defaultMessage: 'Create type'
    },
    cancel: { id: 'schemaBuilder.newType.cancel', defaultMessage: 'Cancel' }
});

type Kind = TypeDoc['kind'];
type Flag = 'publishable' | 'paranoid' | 'i18n';

const KINDS = [
    {
        kind: 'collection',
        icon: Table2,
        title: messages.collection,
        example: messages.collectionExample
    },
    {
        kind: 'single',
        icon: FileText,
        title: messages.single,
        example: messages.singleExample
    }
] as const;
const FLAGS: { flag: Flag; hint: typeof messages.i18nHint }[] = [
    { flag: 'publishable', hint: messages.publishableHint },
    { flag: 'paranoid', hint: messages.paranoidHint },
    { flag: 'i18n', hint: messages.i18nHint }
];
const DEFAULT_FLAGS: Record<Flag, boolean> = {
    publishable: true,
    paranoid: true,
    i18n: false
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taken: readonly string[];
    onCreate: (
        name: string,
        label: string,
        kind: Kind,
        options: NewTypeOptions
    ) => void;
};

/** Arrow keys move the choice within a radio group of buttons. */
function arrows<T>(
    items: readonly T[],
    current: T,
    pick: (next: T) => void
): (event: KeyboardEvent<HTMLElement>) => void {
    return (event) => {
        const step = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1
        }[event.key];
        if (step === undefined) return;
        event.preventDefault();
        // React clears `currentTarget` once the handler returns.
        const group = event.currentTarget;
        const index = items.indexOf(current);
        pick(items[(index + step + items.length) % items.length]);
        // Focus follows the choice: the checked radio is the one tab stop.
        requestAnimationFrame(() =>
            group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
        );
    };
}

/**
 * A new type in one dialog: its name and machine name (suggested from the
 * name until edited), its kind as two cards with an example of each, what
 * it starts from — blank, or a template's fields — and its features. What
 * becomes fixed once applied is said once, at the foot, not under every
 * control.
 */
export function NewTypeDialog({ open, onOpenChange, taken, onCreate }: Props) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [name, setName] = useState('');
    const [nameEdited, setNameEdited] = useState(false);
    const [kind, setKind] = useState<Kind>('collection');
    const [template, setTemplate] = useState<TypeTemplate>(TYPE_TEMPLATES[0]);
    const [flags, setFlags] = useState(DEFAULT_FLAGS);
    const value = nameEdited ? name : toTypeName(label);
    const error = taken.includes(value)
        ? intl.formatMessage(messages.nameTaken)
        : value && !/^[a-z][a-z0-9_]*$/.test(value)
          ? intl.formatMessage(messages.nameInvalid)
          : undefined;

    const reset = () => {
        setLabel('');
        setName('');
        setNameEdited(false);
        setKind('collection');
        setTemplate(TYPE_TEMPLATES[0]);
        setFlags(DEFAULT_FLAGS);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!value || error) return;
        onCreate(value, label.trim(), kind, {
            ...flags,
            fields: template.fields()
        });
        reset();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {intl.formatMessage(messages.title)}
                        </DialogTitle>
                        <DialogDescription>
                            {intl.formatMessage(messages.description)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <InputField
                            id="new-type-label"
                            label={intl.formatMessage(messages.label)}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            autoFocus
                        />
                        <InputField
                            id="new-type-name"
                            label={intl.formatMessage(messages.name)}
                            className="font-mono"
                            value={value}
                            error={error}
                            onChange={(e) => {
                                setNameEdited(true);
                                setName(e.target.value);
                            }}
                        />
                    </div>
                    <div
                        role="radiogroup"
                        aria-label={intl.formatMessage(messages.kind)}
                        className="grid gap-3 sm:grid-cols-2"
                        onKeyDown={arrows(
                            KINDS.map((entry) => entry.kind),
                            kind,
                            setKind
                        )}
                    >
                        {KINDS.map((entry) => (
                            <KindCard
                                key={entry.kind}
                                id={`new-type-${entry.kind}`}
                                icon={entry.icon}
                                title={intl.formatMessage(entry.title)}
                                example={intl.formatMessage(entry.example)}
                                selected={kind === entry.kind}
                                onSelect={() => setKind(entry.kind)}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        <span
                            id="new-type-start"
                            className="text-sm font-medium"
                        >
                            {intl.formatMessage(messages.startFrom)}
                        </span>
                        <div
                            role="radiogroup"
                            aria-labelledby="new-type-start"
                            className="flex flex-wrap gap-2"
                            onKeyDown={arrows(
                                TYPE_TEMPLATES,
                                template,
                                setTemplate
                            )}
                        >
                            {TYPE_TEMPLATES.map((entry) => {
                                const selected = entry.id === template.id;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        tabIndex={selected ? 0 : -1}
                                        onClick={() => setTemplate(entry)}
                                        className={cn(
                                            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                            selected
                                                ? 'border-foreground bg-foreground text-background'
                                                : 'hover:bg-accent/60'
                                        )}
                                    >
                                        {intl.formatMessage(messages[entry.id])}
                                        {entry.names.length > 0 && (
                                            <span
                                                className={
                                                    selected
                                                        ? 'opacity-70'
                                                        : 'text-muted-foreground'
                                                }
                                            >
                                                · {entry.names.join(', ')}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-2 text-sm font-medium">
                            {intl.formatMessage(messages.features)}
                        </legend>
                        {FLAGS.map(({ flag, hint }) => (
                            <div
                                key={flag}
                                className="flex items-start gap-2.5"
                            >
                                <Checkbox
                                    id={`new-type-flag-${flag}`}
                                    checked={flags[flag]}
                                    onCheckedChange={(checked) =>
                                        setFlags((current) => ({
                                            ...current,
                                            [flag]: checked === true
                                        }))
                                    }
                                    aria-describedby={`new-type-flag-${flag}-hint`}
                                    className="mt-0.5"
                                />
                                <div className="flex flex-col gap-0.5">
                                    <Label htmlFor={`new-type-flag-${flag}`}>
                                        {intl.formatMessage(messages[flag])}
                                    </Label>
                                    <p
                                        id={`new-type-flag-${flag}-hint`}
                                        className="text-xs text-muted-foreground"
                                    >
                                        {intl.formatMessage(hint)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </fieldset>
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
                        {intl.formatMessage(messages.fixed)}
                    </p>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={!value || Boolean(error)}
                        >
                            {intl.formatMessage(messages.create)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
