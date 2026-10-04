import { defineMessages, useIntl } from 'react-intl';
import { Check, Minus } from 'lucide-react';
import type { TypeDoc } from '@orthacms/schema-builder-domain';

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
    on: { id: 'schemaBuilder.type.flagOn', defaultMessage: 'on' },
    off: { id: 'schemaBuilder.type.flagOff', defaultMessage: 'off' }
});

const FLAGS = ['publishable', 'paranoid', 'i18n'] as const;

/** The three type flags, each saying on or off in words as well as by its mark. */
export function TypeFlags({ type }: { type: TypeDoc }) {
    const intl = useIntl();
    return (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {FLAGS.map((flag) => {
                const on = type[flag];
                const Mark = on ? Check : Minus;
                return (
                    <li
                        key={flag}
                        className={
                            on
                                ? 'flex items-center gap-1.5'
                                : 'flex items-center gap-1.5 text-muted-foreground'
                        }
                    >
                        <Mark className="size-4" aria-hidden />
                        {intl.formatMessage(messages[flag])}
                        <span className="sr-only">
                            :{' '}
                            {intl.formatMessage(
                                on ? messages.on : messages.off
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
