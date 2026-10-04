import { defineMessages, useIntl } from 'react-intl';
import type { ApplyReadiness } from '../../../../domain/applyReadiness';

const messages = defineMessages({
    blocked: {
        id: 'schemaBuilder.readiness.blocked',
        defaultMessage: 'Some changes cannot be applied. Undo them to continue.'
    },
    nothing: {
        id: 'schemaBuilder.readiness.nothing',
        defaultMessage: 'Nothing to apply.'
    },
    name: {
        id: 'schemaBuilder.readiness.name',
        defaultMessage:
            'Give the migration a name: lowercase letters, digits and underscores.'
    },
    unconfirmed: {
        id: 'schemaBuilder.readiness.unconfirmed',
        defaultMessage:
            '{count, plural, one {Confirm the change that deletes data.} other {Confirm each of the # changes that delete data.}}'
    }
});

/** Why Apply is off, in one line — next to the button it explains. */
export function ReadinessHint({
    readiness,
    id
}: {
    readiness: ApplyReadiness | null;
    id: string;
}) {
    const intl = useIntl();
    if (!readiness || readiness.ok) return null;
    return (
        <p id={id} className="text-xs text-muted-foreground">
            {readiness.reason === 'unconfirmed'
                ? intl.formatMessage(messages.unconfirmed, {
                      count: readiness.missing.length
                  })
                : intl.formatMessage(messages[readiness.reason])}
        </p>
    );
}
