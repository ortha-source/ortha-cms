import { defineMessages, useIntl } from 'react-intl';
import {
    InputField,
    Label,
    RadioGroup,
    RadioGroupItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { FIELD_CAPABILITIES } from '../../../../domain/fieldCapabilities';
import type { FieldEditor } from '../../../../application/useFieldEditor';
import { SwitchField } from '../SwitchField';

const messages = defineMessages({
    description: {
        id: 'schemaBuilder.display.description',
        defaultMessage: 'Help text'
    },
    placeholder: {
        id: 'schemaBuilder.display.placeholder',
        defaultMessage: 'Placeholder'
    },
    width: { id: 'schemaBuilder.display.width', defaultMessage: 'Width' },
    full: { id: 'schemaBuilder.display.full', defaultMessage: 'Full row' },
    half: { id: 'schemaBuilder.display.half', defaultMessage: 'Half row' },
    widthHint: {
        id: 'schemaBuilder.display.widthHint',
        defaultMessage:
            'Two half-row fields next to each other share one line in the entry editor.'
    },
    group: {
        id: 'schemaBuilder.display.group',
        defaultMessage: 'Group on the General tab'
    },
    noGroup: {
        id: 'schemaBuilder.display.noGroup',
        defaultMessage: 'None — above the groups'
    },
    hidden: {
        id: 'schemaBuilder.display.hidden',
        defaultMessage: 'Hide from the form'
    },
    hiddenHint: {
        id: 'schemaBuilder.display.hiddenHint',
        defaultMessage: 'Still stored and served by the API.'
    },
    ownTab: {
        id: 'schemaBuilder.display.ownTab',
        defaultMessage:
            'This field is drawn on its own built-in tab, so it has no group or width.'
    }
});

type Props = { editor: FieldEditor; type: TypeDoc };

/**
 * The `admin` options: help text, placeholder, width, group, hidden. The
 * control is the field's kind — long text is a textarea, rich text the
 * editor — so there is none to pick here; a widget a schema already carries
 * is kept as it is. There is no row key to type: two adjacent half-row fields share a
 * line on their own. A row key a schema already carries is kept as it is.
 */
export function FieldDisplayTab({ editor, type }: Props) {
    const intl = useIntl();
    const admin = editor.entry.spec.admin ?? {};
    const capability = FIELD_CAPABILITIES[editor.entry.spec.type];
    return (
        <div className="flex flex-col gap-4">
            <InputField
                id="display-description"
                label={intl.formatMessage(messages.description)}
                value={admin.description ?? ''}
                onChange={(event) =>
                    editor.setAdmin({ description: event.target.value })
                }
            />
            {capability.placeholder && (
                <InputField
                    id="display-placeholder"
                    label={intl.formatMessage(messages.placeholder)}
                    value={admin.placeholder ?? ''}
                    onChange={(event) =>
                        editor.setAdmin({ placeholder: event.target.value })
                    }
                />
            )}
            {capability.layout ? (
                <>
                    <fieldset
                        className="flex flex-col gap-2"
                        aria-describedby="display-width-hint"
                    >
                        <legend className="mb-1 text-sm font-medium">
                            {intl.formatMessage(messages.width)}
                        </legend>
                        <RadioGroup
                            value={admin.width ?? 'full'}
                            onValueChange={(width) =>
                                editor.setAdmin({
                                    width: width === 'half' ? 'half' : undefined
                                })
                            }
                            className="flex gap-6"
                        >
                            {(['full', 'half'] as const).map((width) => (
                                <div
                                    key={width}
                                    className="flex items-center gap-2"
                                >
                                    <RadioGroupItem
                                        id={`display-width-${width}`}
                                        value={width}
                                    />
                                    <Label htmlFor={`display-width-${width}`}>
                                        {intl.formatMessage(messages[width])}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                        <p
                            id="display-width-hint"
                            className="text-xs text-muted-foreground"
                        >
                            {intl.formatMessage(messages.widthHint)}
                        </p>
                    </fieldset>
                    {type.groups.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="display-group">
                                {intl.formatMessage(messages.group)}
                            </Label>
                            <Select
                                value={admin.group ?? '__none'}
                                onValueChange={(group) =>
                                    editor.setAdmin({
                                        group:
                                            group === '__none'
                                                ? undefined
                                                : group
                                    })
                                }
                            >
                                <SelectTrigger id="display-group">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none">
                                        {intl.formatMessage(messages.noGroup)}
                                    </SelectItem>
                                    {type.groups.map((group) => (
                                        <SelectItem
                                            key={group.key}
                                            value={group.key}
                                        >
                                            {group.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.ownTab)}
                </p>
            )}
            <SwitchField
                id="display-hidden"
                label={intl.formatMessage(messages.hidden)}
                description={intl.formatMessage(messages.hiddenHint)}
                checked={Boolean(admin.hidden)}
                onChange={(hidden) =>
                    editor.setAdmin({ hidden: hidden || undefined })
                }
            />
        </div>
    );
}
