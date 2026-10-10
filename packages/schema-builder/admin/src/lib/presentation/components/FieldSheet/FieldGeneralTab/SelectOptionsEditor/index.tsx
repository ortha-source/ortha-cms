import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, X } from 'lucide-react';
import { Button, Input, Label } from '@orthacms/design-system';
import {
    addOption,
    removeOption,
    renameOption,
    type OptionsField
} from '../../../../../domain/selectOptions';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rules.options', defaultMessage: 'Options' },
    hint: {
        id: 'schemaBuilder.rules.optionsHint',
        defaultMessage:
            'The values stored, and what the default is picked from. Removing one an entry uses makes that entry invalid.'
    },
    add: { id: 'schemaBuilder.rules.optionAdd', defaultMessage: 'Add option' },
    newOption: {
        id: 'schemaBuilder.rules.optionNew',
        defaultMessage: 'New option'
    },
    remove: {
        id: 'schemaBuilder.rules.optionRemove',
        defaultMessage: 'Remove {option}'
    },
    option: {
        id: 'schemaBuilder.rules.optionLabel',
        defaultMessage: 'Option {index}'
    }
});

type Props = {
    field: OptionsField;
    onChange: (patch: Record<string, unknown>) => void;
};

/**
 * A select's `options`, in order. The DSL has no option labels — the value is
 * what is shown. Drawn above the default, which is picked from them: renaming
 * the option the default names carries the default along, removing it clears
 * it.
 */
export function SelectOptionsEditor({ field, onChange }: Props) {
    const intl = useIntl();
    const { options } = field;
    const [next, setNext] = useState('');
    const add = () => {
        const patch = addOption(field, next);
        if (!patch) return;
        onChange(patch);
        setNext('');
    };
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
                {intl.formatMessage(messages.label)}
            </legend>
            <p className="text-xs text-muted-foreground">
                {intl.formatMessage(messages.hint)}
            </p>
            <ul className="flex flex-col gap-2">
                {options.map((option, index) => (
                    // Keyed by position, never by value: the value changes on
                    // every keystroke, and a new key remounts the input and
                    // drops the focus. Each row is fully controlled, so the
                    // position is all the identity it needs.
                    <li key={index} className="flex items-center gap-2">
                        <Input
                            aria-label={intl.formatMessage(messages.option, {
                                index: index + 1
                            })}
                            className="font-mono"
                            value={option}
                            onChange={(event) =>
                                onChange(
                                    renameOption(
                                        field,
                                        index,
                                        event.target.value
                                    )
                                )
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={intl.formatMessage(messages.remove, {
                                option
                            })}
                            onClick={() => onChange(removeOption(field, index))}
                        >
                            <X />
                        </Button>
                    </li>
                ))}
            </ul>
            <div className="flex items-center gap-2">
                <Label htmlFor="rule-option-new" className="sr-only">
                    {intl.formatMessage(messages.newOption)}
                </Label>
                <Input
                    id="rule-option-new"
                    className="font-mono"
                    placeholder={intl.formatMessage(messages.newOption)}
                    value={next}
                    onChange={(event) => setNext(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            add();
                        }
                    }}
                />
                <Button type="button" variant="outline" onClick={add}>
                    <Plus />
                    {intl.formatMessage(messages.add)}
                </Button>
            </div>
        </fieldset>
    );
}
