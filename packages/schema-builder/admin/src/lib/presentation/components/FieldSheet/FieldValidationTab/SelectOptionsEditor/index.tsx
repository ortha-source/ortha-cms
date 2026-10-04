import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, X } from 'lucide-react';
import { Button, Input, Label } from '@orthacms/design-system';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rules.options', defaultMessage: 'Options' },
    hint: {
        id: 'schemaBuilder.rules.optionsHint',
        defaultMessage:
            'The values stored. Removing one an entry uses makes that entry invalid.'
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
    options: readonly string[];
    onChange: (patch: Record<string, unknown>) => void;
};

/** A select's `options`, in order. The DSL has no option labels — the value is what is shown. */
export function SelectOptionsEditor({ options, onChange }: Props) {
    const intl = useIntl();
    const [next, setNext] = useState('');
    const set = (values: string[]) => onChange({ options: values });
    const add = () => {
        const value = next.trim();
        if (!value || options.includes(value)) return;
        set([...options, value]);
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
                    <li
                        key={`${index}:${option}`}
                        className="flex items-center gap-2"
                    >
                        <Input
                            aria-label={intl.formatMessage(messages.option, {
                                index: index + 1
                            })}
                            className="font-mono"
                            value={option}
                            onChange={(event) =>
                                set(
                                    options.map((value, at) =>
                                        at === index
                                            ? event.target.value
                                            : value
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
                            onClick={() =>
                                set(options.filter((_, at) => at !== index))
                            }
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
