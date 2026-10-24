import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, Database, FileCode } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@orthacms/design-system';
import type { SchemaPlan } from '@orthacms/schema-builder-domain';
import { FilesTab } from '../FilesTab';
import { SqlTab } from '../SqlTab';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.review.technical',
        defaultMessage: 'Technical details'
    },
    summary: {
        id: 'schemaBuilder.review.technicalSummary',
        defaultMessage:
            '{files, plural, one {# file} other {# files}} · {migrations, plural, =0 {no migration} one {# migration} other {# migrations}}'
    },
    files: { id: 'schemaBuilder.review.tabFiles', defaultMessage: 'Files' },
    sql: { id: 'schemaBuilder.review.tabSql', defaultMessage: 'SQL' }
});

/**
 * What an apply writes under `src/content` and the migration drizzle-kit
 * generated, exactly as it will run — folded, there for whoever wants it and
 * out of the way of whoever does not.
 */
export function TechnicalDetails({ plan }: { plan: SchemaPlan }) {
    const intl = useIntl();
    return (
        <Collapsible className="rounded-xl border bg-card shadow-xs">
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight
                    className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
                    aria-hidden
                />
                <span className="text-sm font-medium">
                    {intl.formatMessage(messages.title)}
                </span>
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.summary, {
                        files: plan.files.length,
                        migrations: plan.sql.length
                    })}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t">
                <Tabs defaultValue="files">
                    <TabsList className="px-4 pt-2">
                        <TabsTrigger value="files">
                            <FileCode aria-hidden className="size-4" />
                            {intl.formatMessage(messages.files)}
                        </TabsTrigger>
                        <TabsTrigger value="sql">
                            <Database aria-hidden className="size-4" />
                            {intl.formatMessage(messages.sql)}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="files" className="mt-0 px-4">
                        <FilesTab files={plan.files} />
                    </TabsContent>
                    <TabsContent value="sql" className="mt-0 px-4">
                        <SqlTab sql={plan.sql} />
                    </TabsContent>
                </Tabs>
            </CollapsibleContent>
        </Collapsible>
    );
}
