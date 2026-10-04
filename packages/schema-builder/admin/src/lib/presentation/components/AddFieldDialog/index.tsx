import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputField
} from '@orthacms/design-system';
import type { FieldDocType } from '@orthacms/schema-builder-domain';
import { FIELD_CATALOG } from '../../../domain/fieldCatalog';
import { toFieldName } from '../../../domain/identifiers';
import { FieldTypeTile } from './FieldTypeTile';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.addField.title',
        defaultMessage: 'Add a field'
    },
    description: {
        id: 'schemaBuilder.addField.description',
        defaultMessage:
            'Pick its type and name it. Everything else is set in the field’s sheet, which opens next.'
    },
    type: { id: 'schemaBuilder.addField.type', defaultMessage: 'Type' },
    label: { id: 'schemaBuilder.addField.label', defaultMessage: 'Label' },
    name: { id: 'schemaBuilder.addField.name', defaultMessage: 'Machine name' },
    nameTaken: {
        id: 'schemaBuilder.addField.nameTaken',
        defaultMessage: 'This type already has a field by that name.'
    },
    nameInvalid: {
        id: 'schemaBuilder.addField.nameInvalid',
        defaultMessage: 'Start with a letter; letters and digits only.'
    },
    add: { id: 'schemaBuilder.addField.add', defaultMessage: 'Add field' },
    cancel: { id: 'schemaBuilder.addField.cancel', defaultMessage: 'Cancel' }
});

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taken: readonly string[];
    onAdd: (type: FieldDocType, name: string, label: string) => void;
};

/** Type, label, machine name — the three things a field cannot be added without. */
export function AddFieldDialog({ open, onOpenChange, taken, onAdd }: Props) {
    const intl = useIntl();
    const [type, setType] = useState<FieldDocType>('text');
    const [label, setLabel] = useState('');
    const [name, setName] = useState<string | null>(null);
    const value = name ?? toFieldName(label);
    const error = taken.includes(value)
        ? intl.formatMessage(messages.nameTaken)
        : value && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)
          ? intl.formatMessage(messages.nameInvalid)
          : undefined;

    // Arrow keys move the choice, as in any radio group.
    const onGridKey = (event: KeyboardEvent) => {
        const step = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1
        }[event.key];
        if (!step) return;
        event.preventDefault();
        const index = FIELD_CATALOG.findIndex((entry) => entry.type === type);
        const next =
            FIELD_CATALOG[
                (index + step + FIELD_CATALOG.length) % FIELD_CATALOG.length
            ].type;
        setType(next);
        (
            event.currentTarget.querySelector(
                `[data-type="${next}"] button`
            ) as HTMLElement | null
        )?.focus();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!value || error) return;
        onAdd(type, value, label.trim());
        setLabel('');
        setName(null);
        setType('text');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {intl.formatMessage(messages.title)}
                        </DialogTitle>
                        <DialogDescription>
                            {intl.formatMessage(messages.description)}
                        </DialogDescription>
                    </DialogHeader>
                    <div
                        role="radiogroup"
                        aria-label={intl.formatMessage(messages.type)}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        onKeyDown={onGridKey}
                    >
                        {FIELD_CATALOG.map((entry) => (
                            <div
                                key={entry.type}
                                data-type={entry.type}
                                className="contents"
                            >
                                <FieldTypeTile
                                    type={entry.type}
                                    selected={entry.type === type}
                                    onSelect={() => setType(entry.type)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <InputField
                            id="add-field-label"
                            label={intl.formatMessage(messages.label)}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                        />
                        <InputField
                            id="add-field-name"
                            label={intl.formatMessage(messages.name)}
                            className="font-mono"
                            value={value}
                            error={error}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
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
                            {intl.formatMessage(messages.add)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
