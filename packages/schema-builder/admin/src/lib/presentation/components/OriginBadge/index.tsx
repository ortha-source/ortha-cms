import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';
import type { TypeOrigin } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    code: { id: 'schemaBuilder.origin.code', defaultMessage: 'code' },
    builder: { id: 'schemaBuilder.origin.builder', defaultMessage: 'builder' },
    new: { id: 'schemaBuilder.origin.new', defaultMessage: 'new' },
    codeHint: {
        id: 'schemaBuilder.origin.codeHint',
        defaultMessage: 'Written by hand'
    },
    builderHint: {
        id: 'schemaBuilder.origin.builderHint',
        defaultMessage: 'Managed by the schema builder'
    },
    newHint: {
        id: 'schemaBuilder.origin.newHint',
        defaultMessage: 'Not created yet'
    }
});

const VARIANT = {
    code: 'outline',
    builder: 'info',
    new: 'primary-soft'
} as const;
const HINT = {
    code: messages.codeHint,
    builder: messages.builderHint,
    new: messages.newHint
};

/** Who owns a type's file. The visible word is short; the hint says it in full. */
export function OriginBadge({ origin }: { origin: TypeOrigin }) {
    const intl = useIntl();
    const hint = intl.formatMessage(HINT[origin]);
    return (
        <Badge variant={VARIANT[origin]} className="font-normal" title={hint}>
            <span className="sr-only">{hint}</span>
            <span aria-hidden>{intl.formatMessage(messages[origin])}</span>
        </Badge>
    );
}
