import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, InputField, Label } from '@orthacms/design-system';
import { MEDIA_KIND_VALUES } from '@orthacms/content-domain';
import type { MediaAcceptDoc } from '@orthacms/schema-builder-domain';
import { SwitchField } from '../../SwitchField';

const messages = defineMessages({
    multiple: {
        id: 'schemaBuilder.rules.multiple',
        defaultMessage: 'Several files'
    },
    kinds: {
        id: 'schemaBuilder.rules.kinds',
        defaultMessage: 'Accepted kinds'
    },
    kindsHint: {
        id: 'schemaBuilder.rules.kindsHint',
        defaultMessage: 'None ticked accepts every kind.'
    },
    mimeTypes: {
        id: 'schemaBuilder.rules.mimeTypes',
        defaultMessage: 'Accepted MIME types'
    },
    mimeTypesHint: {
        id: 'schemaBuilder.rules.mimeTypesHint',
        defaultMessage: 'Comma-separated, e.g. image/png, application/pdf.'
    }
});

type Props = {
    multiple?: boolean;
    accept?: MediaAcceptDoc;
    onChange: (patch: Record<string, unknown>) => void;
};

/** A media field's `multiple` and `accept` (kinds and MIME types). */
export function MediaAcceptRules({ multiple, accept, onChange }: Props) {
    const intl = useIntl();
    const kinds = accept?.kinds ?? [];
    const setAccept = (next: MediaAcceptDoc) => {
        const cleaned = {
            ...(next.kinds?.length ? { kinds: next.kinds } : {}),
            ...(next.mimeTypes?.length ? { mimeTypes: next.mimeTypes } : {})
        };
        onChange({ accept: Object.keys(cleaned).length ? cleaned : undefined });
    };
    return (
        <div className="flex flex-col gap-4">
            <SwitchField
                id="rule-multiple"
                label={intl.formatMessage(messages.multiple)}
                checked={Boolean(multiple)}
                onChange={(on) => onChange({ multiple: on || undefined })}
            />
            <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                    {intl.formatMessage(messages.kinds)}
                </legend>
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.kindsHint)}
                </p>
                <div className="flex flex-wrap gap-4">
                    {MEDIA_KIND_VALUES.map((kind) => (
                        <div key={kind} className="flex items-center gap-2">
                            <Checkbox
                                id={`rule-kind-${kind}`}
                                checked={kinds.includes(kind)}
                                onCheckedChange={(on) =>
                                    setAccept({
                                        ...accept,
                                        kinds: on
                                            ? [...kinds, kind]
                                            : kinds.filter(
                                                  (value) => value !== kind
                                              )
                                    })
                                }
                            />
                            <Label htmlFor={`rule-kind-${kind}`}>{kind}</Label>
                        </div>
                    ))}
                </div>
            </fieldset>
            <InputField
                id="rule-mime-types"
                label={intl.formatMessage(messages.mimeTypes)}
                description={intl.formatMessage(messages.mimeTypesHint)}
                className="font-mono"
                defaultValue={(accept?.mimeTypes ?? []).join(', ')}
                onBlur={(event) =>
                    setAccept({
                        ...accept,
                        mimeTypes: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean)
                    })
                }
            />
        </div>
    );
}
