import { defineMessages, useIntl } from 'react-intl';
import { FileText, Table2 } from 'lucide-react';
import { Badge } from '@ortha-cms/design-system';
import type { RouteContext } from '../../application/readRouteContext';

const messages = defineMessages({
    label: {
        id: 'copilot.context.label',
        defaultMessage: 'Looking at'
    },
    entry: {
        id: 'copilot.context.entry',
        defaultMessage: 'this {type} entry'
    },
    records: {
        id: 'copilot.context.records',
        defaultMessage: 'the {type} list'
    }
});

/**
 * What the run is being told about where the user is.
 *
 * Shown because **context attached invisibly is context the user cannot correct
 * when it is wrong** — the URL can easily be stale relative to what someone
 * means, and "this entry" quietly resolving to the last thing they happened to
 * open is worse than not resolving at all. The design's own turn anatomy asks
 * for it: "Your message, plus where you are" (§2).
 *
 * Renders nothing outside the content library, where there is no entry-level
 * context to report and a permanent empty bar would be noise.
 */
export function ContextChip({ context }: { context: RouteContext }) {
    const intl = useIntl();

    if (!context.contentType) {
        return null;
    }

    const isEntry = context.surface === 'entry';
    const Icon = isEntry ? FileText : Table2;

    return (
        <div className="text-muted-foreground flex items-center gap-1.5 px-3 pt-2 text-xs">
            <span>{intl.formatMessage(messages.label)}</span>
            <Badge variant="secondary" className="gap-1 font-normal">
                <Icon className="size-3" />
                {intl.formatMessage(
                    isEntry ? messages.entry : messages.records,
                    { type: context.contentType }
                )}
            </Badge>
            {context.locale && (
                <Badge variant="secondary" className="font-normal uppercase">
                    {context.locale}
                </Badge>
            )}
        </div>
    );
}
