import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    InputField,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@orthacms/design-system';
import type { ApplyFlow } from '../../../application/useApplyFlow';
import { ChangeRow } from './ChangeRow';
import { ChangesSkeleton } from './ChangesSkeleton';
import { FilesTab } from './FilesTab';
import { PlanError } from './PlanError';
import { ReadinessHint } from './ReadinessHint';
import { SqlTab } from './SqlTab';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.changes.title',
        defaultMessage: 'Review changes'
    },
    description: {
        id: 'schemaBuilder.changes.description',
        defaultMessage:
            'What applying will do: the migration runs, the files are written, and the dev server restarts.'
    },
    changes: {
        id: 'schemaBuilder.changes.tabChanges',
        defaultMessage: 'Changes'
    },
    files: { id: 'schemaBuilder.changes.tabFiles', defaultMessage: 'Files' },
    sql: { id: 'schemaBuilder.changes.tabSql', defaultMessage: 'SQL' },
    migrationName: {
        id: 'schemaBuilder.changes.migrationName',
        defaultMessage: 'Migration name'
    },
    apply: { id: 'schemaBuilder.changes.apply', defaultMessage: 'Apply' },
    close: { id: 'schemaBuilder.changes.close', defaultMessage: 'Close' }
});

/**
 * The plan in three tabs — what changes and how risky, the files, the SQL —
 * and the one place an apply starts. The skeleton covers the seconds
 * drizzle-kit takes; Apply says why it is off when it is.
 */
export function ChangesDrawer({ flow }: { flow: ApplyFlow }) {
    const intl = useIntl();
    const plan = flow.plan;
    const ready = flow.readiness?.ok === true;
    return (
        <Sheet open={flow.reviewing} onOpenChange={flow.setReviewing}>
            <SheetContent
                className="flex w-full flex-col overflow-y-auto sm:max-w-xl"
                closeLabel={intl.formatMessage(messages.close)}
            >
                <SheetHeader>
                    <SheetTitle>
                        {intl.formatMessage(messages.title)}
                    </SheetTitle>
                    <SheetDescription>
                        {intl.formatMessage(messages.description)}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 px-4">
                    {plan.isError ? (
                        <PlanError
                            error={plan.error}
                            onRetry={() => plan.mutate()}
                        />
                    ) : (
                        <Tabs defaultValue="changes">
                            <TabsList>
                                <TabsTrigger value="changes">
                                    {intl.formatMessage(messages.changes)}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="files"
                                    disabled={!plan.data}
                                >
                                    {intl.formatMessage(messages.files)}
                                </TabsTrigger>
                                <TabsTrigger value="sql" disabled={!plan.data}>
                                    {intl.formatMessage(messages.sql)}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="changes">
                                {!plan.data ? (
                                    <ChangesSkeleton />
                                ) : (
                                    <ul
                                        aria-label={intl.formatMessage(
                                            messages.changes
                                        )}
                                    >
                                        {plan.data.changes.map((item) => (
                                            <ChangeRow
                                                key={item.id}
                                                item={item}
                                                confirmed={flow.confirmed.has(
                                                    item.id
                                                )}
                                                onToggle={flow.toggle}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </TabsContent>
                            <TabsContent value="files">
                                {plan.data && (
                                    <FilesTab files={plan.data.files} />
                                )}
                            </TabsContent>
                            <TabsContent value="sql">
                                {plan.data && <SqlTab sql={plan.data.sql} />}
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
                {plan.data && !plan.data.blocked && (
                    <div className="px-4">
                        <InputField
                            id="migration-name"
                            label={intl.formatMessage(messages.migrationName)}
                            className="font-mono"
                            value={flow.migrationName}
                            onChange={(event) =>
                                flow.setMigrationName(event.target.value)
                            }
                        />
                    </div>
                )}
                <SheetFooter className="flex-col items-stretch gap-2 sm:flex-col">
                    <ReadinessHint
                        readiness={flow.readiness}
                        id="apply-readiness"
                    />
                    <Button
                        onClick={() => void flow.apply()}
                        disabled={!ready}
                        aria-describedby={ready ? undefined : 'apply-readiness'}
                    >
                        {intl.formatMessage(messages.apply)}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
