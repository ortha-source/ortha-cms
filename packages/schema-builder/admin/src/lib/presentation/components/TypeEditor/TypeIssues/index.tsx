import { defineMessages, useIntl } from 'react-intl';
import { AlertTriangle } from 'lucide-react';
import type { SchemaIssue } from '@orthacms/content-domain';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.issues.title',
        defaultMessage:
            '{count, plural, one {This type has a problem} other {This type has # problems}} — it cannot be applied until fixed.'
    }
});

/**
 * The schema rules' verdict on the selected type, in their own words — the
 * sentences the DSL would throw at boot. Live, so fixing one is heard.
 */
export function TypeIssues({ issues }: { issues: readonly SchemaIssue[] }) {
    const intl = useIntl();
    return (
        // Always mounted, so a new problem is announced — but while it is
        // empty it must not take a gap in the editor's column, or the type's
        // first card sits lower than the rail beside it.
        <div aria-live="polite" className="empty:-mb-4">
            {issues.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                        aria-hidden
                    />
                    <div className="flex flex-col gap-1">
                        <p className="font-medium">
                            {intl.formatMessage(messages.title, {
                                count: issues.length
                            })}
                        </p>
                        <ul className="list-disc pl-4 text-muted-foreground">
                            {issues.map((issue) => (
                                <li key={`${issue.path}:${issue.code}`}>
                                    {issue.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
