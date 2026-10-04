import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { StagedFile } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    created: { id: 'schemaBuilder.files.created', defaultMessage: 'new' },
    changed: { id: 'schemaBuilder.files.changed', defaultMessage: 'changed' },
    deleted: { id: 'schemaBuilder.files.deleted', defaultMessage: 'deleted' },
    none: {
        id: 'schemaBuilder.files.none',
        defaultMessage: 'No file under src/content changes.'
    }
});

/** The files under `src/content/` an apply writes or deletes, each with what it will hold. */
export function FilesTab({ files }: { files: readonly StagedFile[] }) {
    const intl = useIntl();
    if (files.length === 0)
        return (
            <p className="py-3 text-sm text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </p>
        );
    return (
        <ul className="flex flex-col gap-2 py-3">
            {files.map((file) => {
                const state =
                    file.before === null
                        ? 'created'
                        : file.after === null
                          ? 'deleted'
                          : 'changed';
                return (
                    <li key={file.path} className="rounded-lg border">
                        <Collapsible>
                            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <ChevronRight
                                    className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                                    src/content/{file.path}
                                </span>
                                <Badge
                                    variant={
                                        state === 'deleted'
                                            ? 'destructive-soft'
                                            : state === 'created'
                                              ? 'success'
                                              : 'secondary'
                                    }
                                    className="font-normal"
                                >
                                    {intl.formatMessage(messages[state])}
                                </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <pre
                                    className="max-h-80 overflow-auto border-t bg-muted/40 p-3 font-mono text-xs"
                                    tabIndex={0}
                                >
                                    {file.after ?? file.before}
                                </pre>
                            </CollapsibleContent>
                        </Collapsible>
                    </li>
                );
            })}
        </ul>
    );
}
