import { defineMessages, FormattedMessage } from 'react-intl';
import { Lock } from 'lucide-react';
import type { ReadOnlyReason } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    production: {
        id: 'schemaBuilder.readOnly.production',
        defaultMessage:
            'This server runs in production, so the content model is read-only. Change it in development and deploy it.'
    },
    disabled: {
        id: 'schemaBuilder.readOnly.disabled',
        defaultMessage:
            'Editing is off. Set {flag} in {file} and restart the dev server to edit the content model here.'
    },
    'no-source-tree': {
        id: 'schemaBuilder.readOnly.noSourceTree',
        defaultMessage:
            'This server has no source files to edit. Run it from its project with {command}.'
    }
});

const code = (text: string) => (
    <code key={text} className="font-mono text-xs">
        {text}
    </code>
);

/** Says why the whole page is read-only, and how to change that. */
export function ReadOnlyNotice({ reason }: { reason?: ReadOnlyReason }) {
    if (!reason) return null;
    return (
        <p className="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
                <FormattedMessage
                    {...messages[reason]}
                    values={{
                        flag: code('SCHEMA_BUILDER=true'),
                        file: code('.env'),
                        command: code('npm run dev')
                    }}
                />
            </span>
        </p>
    );
}
