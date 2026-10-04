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
    row: { id: 'schemaBuilder.display.row', defaultMessage: 'Share a row' },
    rowHint: {
        id: 'schemaBuilder.display.rowHint',
        defaultMessage:
            'Fields with the same key sit on one line — two at most.'
    },
    group: {
        id: 'schemaBuilder.display.group',
        defaultMessage: 'Group on the General tab'
    },
    noGroup: {
        id: 'schemaBuilder.display.noGroup',
        defaultMessage: 'None — above the groups'
    },
    widget: { id: 'schemaBuilder.display.widget', defaultMessage: 'Control' },
    defaultWidget: {
        id: 'schemaBuilder.display.defaultWidget',
        defaultMessage: 'Default'
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

/** The `admin` options: help text, placeholder, width, row, group, control, hidden. */
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
                    <fieldset className="flex flex-col gap-2">
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
                    </fieldset>
                    <InputField
                        id="display-row"
                        label={intl.formatMessage(messages.row)}
                        description={intl.formatMessage(messages.rowHint)}
                        className="font-mono"
                        value={admin.row ?? ''}
                        onChange={(event) =>
                            editor.setAdmin({ row: event.target.value })
                        }
                    />
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
            {capability.widgets.length > 0 && (
                <div className="flex flex-col gap-2">
                    <Label htmlFor="display-widget">
                        {intl.formatMessage(messages.widget)}
                    </Label>
                    <Select
                        value={admin.widget ?? '__default'}
                        onValueChange={(widget) =>
                            editor.setAdmin({
                                widget:
                                    widget === '__default' ? undefined : widget
                            })
                        }
                    >
                        <SelectTrigger id="display-widget">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__default">
                                {intl.formatMessage(messages.defaultWidget)}
                            </SelectItem>
                            {capability.widgets.map((widget) => (
                                <SelectItem key={widget} value={widget}>
                                    {widget}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
