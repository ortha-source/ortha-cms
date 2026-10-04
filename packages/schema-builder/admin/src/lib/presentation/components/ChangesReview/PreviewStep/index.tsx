import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import type { SchemaPlan } from '@orthacms/schema-builder-domain';
import {
    Button,
    CardContent,
    CardFooter,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    WizardFooter
} from '@orthacms/design-system';
import { FilesTab } from '../FilesTab';
import { SqlTab } from '../SqlTab';
import { StepHeading } from '../StepHeading';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.review.previewTitle',
        defaultMessage: 'Files and SQL'
    },
    description: {
        id: 'schemaBuilder.review.previewDescription',
        defaultMessage:
            'What an apply writes under src/content, and the migration drizzle-kit generated — exactly as it will run.'
    },
    files: { id: 'schemaBuilder.review.tabFiles', defaultMessage: 'Files' },
    sql: { id: 'schemaBuilder.review.tabSql', defaultMessage: 'SQL' },
    back: { id: 'schemaBuilder.review.back', defaultMessage: 'Back' },
    next: {
        id: 'schemaBuilder.review.toApply',
        defaultMessage: 'Continue to apply'
    }
});

type Props = { plan: SchemaPlan; onBack: () => void; onNext: () => void };

/** Step 2: the files and the SQL, one tab each. Nothing to decide — only to read. */
export const PreviewStep = forwardRef<HTMLHeadingElement, Props>(
    function PreviewStep({ plan, onBack, onNext }, ref) {
        const intl = useIntl();
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent>
                    <Tabs defaultValue="files">
                        <TabsList>
                            <TabsTrigger value="files">
                                {intl.formatMessage(messages.files)}
                            </TabsTrigger>
                            <TabsTrigger value="sql">
                                {intl.formatMessage(messages.sql)}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="files">
                            <FilesTab files={plan.files} />
                        </TabsContent>
                        <TabsContent value="sql">
                            <SqlTab sql={plan.sql} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
                <CardFooter>
                    <WizardFooter
                        onBack={onBack}
                        backLabel={intl.formatMessage(messages.back)}
                        primary={
                            <Button type="button" onClick={onNext}>
                                {intl.formatMessage(messages.next)}
                                <ArrowRight />
                            </Button>
                        }
                    />
                </CardFooter>
            </>
        );
    }
);
