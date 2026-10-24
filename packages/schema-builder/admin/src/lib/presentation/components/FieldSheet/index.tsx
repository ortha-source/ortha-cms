import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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
import { validationEditors } from '../../../domain/fieldCapabilities';
import { kindOf } from '../../../domain/fieldCatalog';
import { toLabel } from '../../../domain/identifiers';
import { FieldTypeIcon } from '../FieldTypeIcon';
import { kindCopy } from '../fieldKindCopy';
import { FieldDisplayTab } from './FieldDisplayTab';
import { FieldGeneralTab } from './FieldGeneralTab';
import { FieldPreview } from './FieldPreview';
import { FieldValidationTab } from './FieldValidationTab';

const messages = defineMessages({
    description: {
        id: 'schemaBuilder.sheet.description',
        defaultMessage:
            '{type} field on {typeLabel}. Changes go into the draft as you make them.'
    },
    newDescription: {
        id: 'schemaBuilder.sheet.newDescription',
        defaultMessage:
            'A new {type} field on {typeLabel}. It joins your draft when you add it.'
    },
    newTitle: {
        id: 'schemaBuilder.sheet.newTitle',
        defaultMessage: 'New field'
    },
    general: { id: 'schemaBuilder.sheet.general', defaultMessage: 'General' },
    validation: {
        id: 'schemaBuilder.sheet.validation',
        defaultMessage: 'Validation'
    },
    display: { id: 'schemaBuilder.sheet.display', defaultMessage: 'Display' },
    remove: {
        id: 'schemaBuilder.sheet.remove',
        defaultMessage: 'Remove field'
    },
    back: { id: 'schemaBuilder.sheet.back', defaultMessage: 'Another kind' },
    add: { id: 'schemaBuilder.addField.add', defaultMessage: 'Add field' },
    nameEmpty: {
        id: 'schemaBuilder.addField.nameEmpty',
        defaultMessage: 'Give the field a label or a machine name.'
    },
    done: { id: 'schemaBuilder.sheet.done', defaultMessage: 'Done' },
    close: { id: 'schemaBuilder.sheet.close', defaultMessage: 'Close' }
});

/** What the panel does for a field that is not in the draft yet. */
export type FieldSheetAdding = {
    /** Why the machine name cannot be used, as it is typed. */
    nameError?: string;
    /** The name is still empty — the starting state, said under the button. */
    nameEmpty: boolean;
    ready: boolean;
    onAdd: () => void;
    /** Back to the kind picker. */
    onBack: () => void;
};

type Props = {
    editor: FieldEditor | null;
    type: TypeDoc;
    document: SchemaDocument;
    issues: readonly SchemaIssue[];
    onClose: () => void;
    /** A field in the draft: the footer removes it. */
    onRemove?: () => void;
    /** A field being added: the footer adds it, or goes back to its kind. */
    adding?: FieldSheetAdding;
};

/**
 * One field's panel — the same for a field in the draft and one being
 * added. On top, a preview of the field as an editor will meet it, redrawn
 * as it is edited; then its options in three tabs. Validation is there only
 * when the type takes rules — the panel offers exactly what the DSL's options
 * for that type are (ADR-0020 §5). The rules' issues about the field are
 * read out above the tabs. The footer removes a field, or adds a new one.
 */
export function FieldSheet({
    editor,
    type,
    document,
    issues,
    onClose,
    onRemove,
    adding
}: Props) {
    const intl = useIntl();
    const spec = editor?.entry.spec;
    const name = editor?.entry.name ?? '';
    const title =
        spec?.admin?.label ||
        (name ? toLabel(name) : intl.formatMessage(messages.newTitle));
    return (
        <Sheet
            open={Boolean(editor)}
            onOpenChange={(open) => !open && onClose()}
        >
            <SheetContent
                className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
                closeLabel={intl.formatMessage(messages.close)}
            >
                {editor && spec && (
                    <>
                        <SheetHeader className="px-5 pb-3 pt-5">
                            <div className="flex items-center gap-2.5 pr-8">
                                <FieldTypeIcon type={spec.type} />
                                <SheetTitle className="truncate">
                                    {title}
                                </SheetTitle>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {intl.formatMessage(
                                        kindCopy(kindOf(spec)).label
                                    )}
                                </span>
                            </div>
                            <SheetDescription className="sr-only">
                                {intl.formatMessage(
                                    adding
                                        ? messages.newDescription
                                        : messages.description,
                                    {
                                        type: intl.formatMessage(
                                            kindCopy(kindOf(spec)).label
                                        ),
                                        typeLabel: type.label || type.name
                                    }
                                )}
                            </SheetDescription>
                        </SheetHeader>
                        <Tabs
                            defaultValue="general"
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            <TabsList className="px-5">
                                <TabsTrigger value="general">
                                    {intl.formatMessage(messages.general)}
                                </TabsTrigger>
                                {validationEditors(spec).length > 0 && (
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
                            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                                <FieldPreview entry={editor.entry} />
                                {/* Mounted while empty, so it is a live region when issues
                                    arrive; it gives the gap back meanwhile. */}
                                <div
                                    aria-live="polite"
                                    className={
                                        issues.length > 0 ? undefined : '-mt-4'
                                    }
                                >
                                    {issues.length > 0 && (
                                        <ul className="list-disc rounded-lg border border-destructive/40 bg-destructive/5 py-2 pl-8 pr-3 text-sm">
                                            {issues.map((issue) => (
                                                <li key={issue.code}>
                                                    {issue.message}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <TabsContent value="general" className="mt-0">
                                    <FieldGeneralTab
                                        editor={editor}
                                        type={type}
                                        document={document}
                                        nameError={adding?.nameError}
                                        autoFocusLabel={Boolean(adding)}
                                    />
                                </TabsContent>
                                <TabsContent
                                    value="validation"
                                    className="mt-0"
                                >
                                    <FieldValidationTab editor={editor} />
                                </TabsContent>
                                <TabsContent value="display" className="mt-0">
                                    <FieldDisplayTab
                                        editor={editor}
                                        type={type}
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                        <SheetFooter className="flex-row items-start justify-between border-t px-5 py-3 sm:justify-between">
                            {adding ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={adding.onBack}
                                    >
                                        <ArrowLeft />
                                        {intl.formatMessage(messages.back)}
                                    </Button>
                                    <div className="flex flex-col items-end gap-1">
                                        <Button
                                            onClick={adding.onAdd}
                                            disabled={!adding.ready}
                                            aria-describedby={
                                                adding.nameEmpty
                                                    ? 'add-field-name-hint'
                                                    : undefined
                                            }
                                        >
                                            <Plus />
                                            {intl.formatMessage(messages.add)}
                                        </Button>
                                        {adding.nameEmpty && (
                                            <p
                                                id="add-field-name-hint"
                                                className="text-xs text-muted-foreground"
                                            >
                                                {intl.formatMessage(
                                                    messages.nameEmpty
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {onRemove ? (
                                        <Button
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive"
                                            onClick={onRemove}
                                        >
                                            <Trash2 />
                                            {intl.formatMessage(
                                                messages.remove
                                            )}
                                        </Button>
                                    ) : (
                                        <span />
                                    )}
                                    <Button onClick={onClose}>
                                        {intl.formatMessage(messages.done)}
                                    </Button>
                                </>
                            )}
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
