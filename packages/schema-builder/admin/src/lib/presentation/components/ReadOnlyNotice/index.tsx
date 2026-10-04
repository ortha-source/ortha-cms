import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { Lock } from 'lucide-react';
import type { AccessReason } from '../../../application/useBuilderAccess';

const messages = defineMessages({
    'no-permission': {
        id: 'schemaBuilder.readOnly.noPermission',
        defaultMessage:
            'You can read the content model. Changing it needs the {permission} permission.'
    },
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
    'hand-written-manifest': {
        id: 'schemaBuilder.readOnly.handWrittenManifest',
        defaultMessage:
            'The content manifest {file} was written by hand, and every change rewrites it. Run {command} once to let the builder own it.'
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

/** The code fragments each sentence names. */
const VALUES: Record<AccessReason, Record<string, ReactNode>> = {
    'no-permission': { permission: code('schema:manage') },
    production: {},
    disabled: { flag: code('SCHEMA_BUILDER=true'), file: code('.env') },
    'no-source-tree': { command: code('npm run dev') },
    'hand-written-manifest': {
        file: code('src/content/index.ts'),
        command: code('orthacms content sync')
    }
};

/** Says why the whole page is read-only, and how to change that. */
export function ReadOnlyNotice({ reason }: { reason?: AccessReason }) {
    if (!reason) return null;
    return (
        <p className="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
                <FormattedMessage
                    {...messages[reason]}
                    values={VALUES[reason]}
                />
            </span>
        </p>
    );
}
