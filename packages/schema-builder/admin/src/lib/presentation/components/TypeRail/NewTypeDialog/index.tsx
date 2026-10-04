import { useState, type FormEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputField,
    Label,
    RadioGroup,
    RadioGroupItem
} from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { toTypeName } from '../../../../domain/identifiers';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.newType.title',
        defaultMessage: 'New content type'
    },
    description: {
        id: 'schemaBuilder.newType.description',
        defaultMessage:
            'A collection holds many entries; a page holds one. The kind and the machine name are fixed once applied.'
    },
    label: { id: 'schemaBuilder.newType.label', defaultMessage: 'Label' },
    name: { id: 'schemaBuilder.newType.name', defaultMessage: 'Machine name' },
    nameHint: {
        id: 'schemaBuilder.newType.nameHint',
        defaultMessage: 'Lowercase letters, digits and underscores.'
    },
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
    single: { id: 'schemaBuilder.newType.single', defaultMessage: 'Page' },
    create: { id: 'schemaBuilder.newType.create', defaultMessage: 'Add type' },
    cancel: { id: 'schemaBuilder.newType.cancel', defaultMessage: 'Cancel' }
});

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taken: readonly string[];
    onCreate: (name: string, label: string, kind: TypeDoc['kind']) => void;
};

/** Label, machine name (suggested from the label until edited) and kind. */
export function NewTypeDialog({ open, onOpenChange, taken, onCreate }: Props) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [name, setName] = useState('');
    const [nameEdited, setNameEdited] = useState(false);
    const [kind, setKind] = useState<TypeDoc['kind']>('collection');
    const value = nameEdited ? name : toTypeName(label);
    const error = taken.includes(value)
        ? intl.formatMessage(messages.nameTaken)
        : value && !/^[a-z][a-z0-9_]*$/.test(value)
          ? intl.formatMessage(messages.nameInvalid)
          : undefined;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!value || error) return;
        onCreate(value, label.trim(), kind);
        setLabel('');
        setName('');
        setNameEdited(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {intl.formatMessage(messages.title)}
                        </DialogTitle>
                        <DialogDescription>
                            {intl.formatMessage(messages.description)}
                        </DialogDescription>
                    </DialogHeader>
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
                        description={intl.formatMessage(messages.nameHint)}
                        className="font-mono"
                        value={value}
                        error={error}
                        onChange={(e) => {
                            setNameEdited(true);
                            setName(e.target.value);
                        }}
                    />
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-medium">
                            {intl.formatMessage(messages.kind)}
                        </legend>
                        <RadioGroup
                            value={kind}
                            onValueChange={(next) =>
                                setKind(next as TypeDoc['kind'])
                            }
                            className="flex gap-6"
                        >
                            {(['collection', 'single'] as const).map(
                                (option) => (
                                    <div
                                        key={option}
                                        className="flex items-center gap-2"
                                    >
                                        <RadioGroupItem
                                            id={`new-type-${option}`}
                                            value={option}
                                        />
                                        <Label htmlFor={`new-type-${option}`}>
                                            {intl.formatMessage(
                                                messages[option]
                                            )}
                                        </Label>
                                    </div>
                                )
                            )}
                        </RadioGroup>
                    </fieldset>
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
