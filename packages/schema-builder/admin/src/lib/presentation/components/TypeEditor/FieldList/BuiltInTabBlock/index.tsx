import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Lock } from 'lucide-react';
import type { BuiltInTab } from '../../../../../domain/builtInTab';

const messages = defineMessages({
    general: { id: 'schemaBuilder.tab.general', defaultMessage: 'General' },
    relations: {
        id: 'schemaBuilder.tab.relations',
        defaultMessage: 'Relations'
    },
    media: { id: 'schemaBuilder.tab.media', defaultMessage: 'Media' },
    builtIn: {
        id: 'schemaBuilder.tab.builtIn',
        defaultMessage: 'built-in tab'
    },
    count: {
        id: 'schemaBuilder.tab.count',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    }
});

type Props = {
    tab: BuiltInTab;
    count: number;
    children: ReactNode;
    action?: ReactNode;
};

/**
 * One of the entry editor's tabs, as a heading over the fields drawn on it. The
 * lock says what the design doc does: tabs are built in, a schema adds none.
 */
export function BuiltInTabBlock({ tab, count, children, action }: Props) {
    const intl = useIntl();
    const headingId = `schema-tab-${tab}`;
    return (
        <section aria-labelledby={headingId} className="border-t">
            <div className="flex items-center gap-2 bg-muted/40 px-4 py-2.5">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden />
                <h4 id={headingId} className="text-sm font-semibold">
                    {intl.formatMessage(messages[tab])}
                </h4>
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.builtIn)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                    {intl.formatMessage(messages.count, { count })}
                </span>
                {action}
            </div>
            {children}
        </section>
    );
}
