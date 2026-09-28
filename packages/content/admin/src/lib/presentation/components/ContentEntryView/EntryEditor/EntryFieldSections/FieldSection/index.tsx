import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import { ChevronRight } from 'lucide-react';
import type { FieldSection as Section } from '../../../../../../domain/fieldSections';
import type { EntryFormState } from '../../../../../hooks/useEntryForm';
import { useSectionOpen } from '../../../../../hooks/useSectionOpen';
import { FieldStack } from '../FieldStack';

const messages = defineMessages({
    fieldCount: {
        id: 'content.form.section.fieldCount',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    },
    blocking: {
        id: 'content.form.section.blocking',
        defaultMessage: '{count} to fix before publishing'
    },
    changed: {
        id: 'content.form.section.changed',
        defaultMessage: '{count} changed'
    }
});

/**
 * One collapsible section of the General tab — a group the schema declared
 * (`groups` on the type, `admin.group` on the field).
 *
 * Folding a section must never hide a problem, so its header carries what is
 * inside it: how many fields still block publishing (counted from the form's
 * strict errors — the very set the Properties rail's publish gate lists, so
 * the two numbers agree), and how many hold unsaved edits. And when a save or
 * publish is refused while a field in it shows an error, the section opens
 * itself, since an error the author has to go looking for is one they will
 * publish around.
 *
 * The heading is an `<h2>` wrapping the trigger button, so heading navigation
 * lands on the section and the button carries `aria-expanded`; the counts sit
 * inside the button and are read as part of its name. Collapsed content is
 * unmounted, which loses nothing: the values live in the form, not the DOM.
 */
export function FieldSection({
    section,
    typeName,
    form,
    isChanged,
    localizedLang
}: {
    section: Section;
    /** The content type, which keys the remembered open state. */
    typeName: string;
    form: EntryFormState;
    isChanged?: (name: string) => boolean;
    /** BCP-47 tag for the section's localized fields — see `FieldStack`. */
    localizedLang?: string;
}) {
    const intl = useIntl();
    const { group, fields } = section;
    const [open, setOpen] = useSectionOpen(
        typeName,
        group.key,
        !group.collapsed
    );

    const blocking = fields.filter((field) => form.errors[field.name]).length;
    const changed = fields.filter((field) => isChanged?.(field.name)).length;
    const showsError = fields.some((field) => form.errorFor(field.name));

    // Open on every save or publish the form turns back while this section
    // shows an error — on the *attempt*, not on the error: an error first shown
    // while the section was open (a touched field) and then folded away must
    // still resurface at the next Publish, and an author who folds it again in
    // between attempts is left alone. The ref skips the mount, so switching
    // back to this tab does not undo a fold.
    const seenRefusals = useRef(form.refusals);
    useEffect(() => {
        if (form.refusals === seenRefusals.current) return;
        seenRefusals.current = form.refusals;
        if (showsError) setOpen(true);
    }, [form.refusals, showsError, setOpen]);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="group/section border-t pt-4"
            data-testid={`entry-field-section-${group.key}`}
        >
            <h2 className="text-sm font-medium">
                <CollapsibleTrigger className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/section:rotate-90"
                    />
                    <span className="flex-1 truncate">{group.label}</span>
                    {blocking > 0 && (
                        <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive-soft-foreground">
                            {intl.formatMessage(messages.blocking, {
                                count: blocking
                            })}
                        </span>
                    )}
                    {changed > 0 && (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-foreground">
                            {intl.formatMessage(messages.changed, {
                                count: changed
                            })}
                        </span>
                    )}
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                        {intl.formatMessage(messages.fieldCount, {
                            count: fields.length
                        })}
                    </span>
                </CollapsibleTrigger>
            </h2>
            {group.description && (
                <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                    {group.description}
                </p>
            )}
            <CollapsibleContent className="pt-4 pl-6">
                <FieldStack
                    fields={fields}
                    form={form}
                    isChanged={isChanged}
                    localizedLang={localizedLang}
                />
            </CollapsibleContent>
        </Collapsible>
    );
}
