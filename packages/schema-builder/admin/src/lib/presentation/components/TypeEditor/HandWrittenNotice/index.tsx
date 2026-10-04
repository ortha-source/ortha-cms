import { defineMessages, FormattedMessage } from 'react-intl';
import { Lock } from 'lucide-react';
import {
    contentFilePath,
    GENERATED_MARKER,
    type TypeDoc
} from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    body: {
        id: 'schemaBuilder.type.handWritten',
        defaultMessage:
            '{label} is written by hand in {file}, so the builder shows it read-only. Edit the file, or add {marker} as its first line to hand it over.'
    }
});

const code = (text: string) => (
    <code key={text} className="font-mono text-xs">
        {text}
    </code>
);

/**
 * Why one type stays read-only on a server that can edit: the builder owns
 * only the files it generated (ADR-0020 §3), and says how to hand one over.
 */
export function HandWrittenNotice({ type }: { type: TypeDoc }) {
    return (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
                <FormattedMessage
                    {...messages.body}
                    values={{
                        label: type.label ?? type.name,
                        file: code(
                            `src/content/${contentFilePath(type.kind, type.name)}`
                        ),
                        marker: code(GENERATED_MARKER)
                    }}
                />
            </span>
        </p>
    );
}
