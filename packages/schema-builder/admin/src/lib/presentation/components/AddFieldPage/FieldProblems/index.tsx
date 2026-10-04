import type { SchemaIssue } from '@orthacms/content-domain';

/** The schema rules' words about the new field, as they would read in the draft. Live. */
export function FieldProblems({ issues }: { issues: readonly SchemaIssue[] }) {
    return (
        <div aria-live="polite">
            {issues.length > 0 && (
                <ul className="mb-4 list-disc rounded-lg border border-destructive/40 bg-destructive/5 py-2 pl-8 pr-3 text-sm">
                    {issues.map((issue) => (
                        <li key={issue.code}>{issue.message}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
