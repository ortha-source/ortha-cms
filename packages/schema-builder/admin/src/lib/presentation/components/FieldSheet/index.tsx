import { defineMessages, useIntl } from 'react-intl';
import type { SchemaIssue } from '@orthacms/content-domain';
import {
    Button,
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
import type { SchemaDocument, TypeDoc } from '@orthacms/schema-builder-domain';
import type { FieldEditor } from '../../../application/useFieldEditor';
import { FIELD_CAPABILITIES } from '../../../domain/fieldCapabilities';
import { FIELD_TYPE_LABEL } from '../AddFieldDialog/FieldTypeTile';
import { FieldDisplayTab } from './FieldDisplayTab';
import { FieldGeneralTab } from './FieldGeneralTab';
import { FieldValidationTab } from './FieldValidationTab';

const messages = defineMessages({
    description: {
        id: 'schemaBuilder.sheet.description',
        defaultMessage:
            '{type} field on {typeLabel}. Changes go into the draft as you make them.'
    },
    general: { id: 'schemaBuilder.sheet.general', defaultMessage: 'General' },
    validation: {
        id: 'schemaBuilder.sheet.validation',
        defaultMessage: 'Validation'
    },
    display: { id: 'schemaBuilder.sheet.display', defaultMessage: 'Display' },
    done: { id: 'schemaBuilder.sheet.done', defaultMessage: 'Done' },
    close: { id: 'schemaBuilder.sheet.close', defaultMessage: 'Close' }
});

type Props = {
    editor: FieldEditor | null;
    type: TypeDoc;
    document: SchemaDocument;
    issues: readonly SchemaIssue[];
    onClose: () => void;
};

/**
 * One field's options in three tabs. Validation is there only when the type
 * takes rules — the sheet offers exactly what the DSL's options for that type
 * are (ADR-0020 §5). The rules' issues about the field are read out on top.
 */
export function FieldSheet({ editor, type, document, issues, onClose }: Props) {
    const intl = useIntl();
    const spec = editor?.entry.spec;
    return (
        <Sheet
            open={Boolean(editor)}
            onOpenChange={(open) => !open && onClose()}
        >
            <SheetContent
                className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg"
                closeLabel={intl.formatMessage(messages.close)}
            >
                {editor && spec && (
                    <>
                        <SheetHeader>
                            <SheetTitle className="font-mono">
                                {editor.entry.name || '…'}
                            </SheetTitle>
                            <SheetDescription>
                                {intl.formatMessage(messages.description, {
                                    type: intl.formatMessage(
                                        FIELD_TYPE_LABEL[spec.type]
                                    ),
                                    typeLabel: type.label || type.name
                                })}
                            </SheetDescription>
                        </SheetHeader>
                        <div aria-live="polite" className="px-4">
                            {issues.length > 0 && (
                                <ul className="mb-2 list-disc rounded-lg border border-destructive/40 bg-destructive/5 py-2 pl-8 pr-3 text-sm">
                                    {issues.map((issue) => (
                                        <li key={issue.code}>
                                            {issue.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <Tabs defaultValue="general" className="flex-1 px-4">
                            <TabsList>
                                <TabsTrigger value="general">
                                    {intl.formatMessage(messages.general)}
                                </TabsTrigger>
                                {FIELD_CAPABILITIES[spec.type].validation
                                    .length > 0 && (
                                    <TabsTrigger value="validation">
                                        {intl.formatMessage(
                                            messages.validation
                                        )}
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="display">
                                    {intl.formatMessage(messages.display)}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="general" className="py-4">
                                <FieldGeneralTab
                                    editor={editor}
                                    type={type}
                                    document={document}
                                />
                            </TabsContent>
                            <TabsContent value="validation" className="py-4">
                                <FieldValidationTab editor={editor} />
                            </TabsContent>
                            <TabsContent value="display" className="py-4">
                                <FieldDisplayTab editor={editor} type={type} />
                            </TabsContent>
                        </Tabs>
                        <SheetFooter>
                            <Button onClick={onClose}>
                                {intl.formatMessage(messages.done)}
                            </Button>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
