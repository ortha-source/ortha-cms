import { defineMessages, useIntl } from 'react-intl';
import { Label, Switch } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { canChangeFlag, type TypeFlag } from '../../../../../domain/typeFlags';

const messages = defineMessages({
    publishable: {
        id: 'schemaBuilder.type.publishable',
        defaultMessage: 'Draft & publish'
    },
    paranoid: {
        id: 'schemaBuilder.type.paranoid',
        defaultMessage: 'Trash (soft delete)'
    },
    i18n: { id: 'schemaBuilder.type.i18n', defaultMessage: 'Localized' },
    fixed: {
        id: 'schemaBuilder.type.flagFixed',
        defaultMessage:
            'Fixed once the type exists — changing it needs a data migration.'
    },
    onlyOn: {
        id: 'schemaBuilder.type.flagOnlyOn',
        defaultMessage: 'Can be turned on. Once applied, it stays on.'
    }
});

type Props = {
    type: TypeDoc;
    /** The type as served — what the draft is judged against. */
    served: TypeDoc | undefined;
    flag: TypeFlag;
    onChange: (value: boolean) => void;
};

/** One storage flag, disabled with the reason when it may not change. */
export function FlagSwitch({ type, served, flag, onChange }: Props) {
    const intl = useIntl();
    const id = `type-flag-${flag}`;
    const changeable = canChangeFlag(type, flag, served);
    // Fixed, or one-way: an existing type may only turn the trash on.
    const hint = !changeable
        ? messages.fixed
        : type.origin === 'new' || !served || flag !== 'paranoid'
          ? null
          : messages.onlyOn;
    return (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={type[flag]}
                disabled={!changeable}
                onCheckedChange={onChange}
                aria-describedby={hint ? `${id}-hint` : undefined}
            />
            <div className="flex flex-col gap-0.5">
                <Label htmlFor={id}>{intl.formatMessage(messages[flag])}</Label>
                {hint && (
                    <p
                        id={`${id}-hint`}
                        className="text-xs text-muted-foreground"
                    >
                        {intl.formatMessage(hint)}
                    </p>
                )}
            </div>
        </div>
    );
}
