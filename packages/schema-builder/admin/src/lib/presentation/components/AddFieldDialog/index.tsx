import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight, Search } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input
} from '@orthacms/design-system';
import { catalogEntry, FIELD_KIND_GROUPS } from '../../../domain/fieldCatalog';
import { kindCopy } from '../fieldKindCopy';
import { FieldKindTile } from './FieldKindTile';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.addField.dialogTitle',
        defaultMessage: 'Add a field to {type}'
    },
    description: {
        id: 'schemaBuilder.addField.dialogDescription',
        defaultMessage:
            'Pick what it holds. You name it and set its rules next, in the field’s panel.'
    },
    search: {
        id: 'schemaBuilder.addField.search',
        defaultMessage: 'Find a kind — “date”, “image”, “tags”…'
    },
    searchLabel: {
        id: 'schemaBuilder.addField.searchLabel',
        defaultMessage: 'Find a kind of field'
    },
    group: { id: 'schemaBuilder.addField.type', defaultMessage: 'Type' },
    none: {
        id: 'schemaBuilder.addField.none',
        defaultMessage: 'No kind of field matches.'
    },
    text: { id: 'schemaBuilder.addField.groupText', defaultMessage: 'Text' },
    numbers: {
        id: 'schemaBuilder.addField.groupNumbers',
        defaultMessage: 'Numbers and dates'
    },
    choices: {
        id: 'schemaBuilder.addField.groupChoices',
        defaultMessage: 'Choices'
    },
    links: { id: 'schemaBuilder.addField.groupLinks', defaultMessage: 'Links' },
    keys: {
        id: 'schemaBuilder.addField.keys',
        defaultMessage: 'Arrow keys to move · Enter to pick'
    },
    cancel: { id: 'schemaBuilder.addField.cancel', defaultMessage: 'Cancel' },
    next: { id: 'schemaBuilder.addField.toBasics', defaultMessage: 'Continue' }
});

type Props = {
    open: boolean;
    typeLabel: string;
    choice: string;
    onChoose: (id: string) => void;
    /** The kind is picked: on to the field's panel. */
    onContinue: () => void;
    onCancel: () => void;
};

/**
 * The first half of adding a field: what it holds. One radio group of kinds
 * in four sections — text, numbers and dates, choices, links — with a search
 * over their names and examples. Arrow keys move the choice, Enter or a
 * double-click continues to the field's panel, where it is named and given
 * its rules.
 */
export function AddFieldDialog({
    open,
    typeLabel,
    choice,
    onChoose,
    onContinue,
    onCancel
}: Props) {
    const intl = useIntl();
    const [query, setQuery] = useState('');
    const groupRef = useRef<HTMLDivElement>(null);
    const needle = query.trim().toLowerCase();
    const matches = (id: string) => {
        if (!needle) return true;
        const copy = kindCopy(id);
        return [copy.label, copy.example, copy.hint]
            .map((message) => intl.formatMessage(message))
            .concat(id)
            .join(' ')
            .toLowerCase()
            .includes(needle);
    };
    const groups = FIELD_KIND_GROUPS.map((group) => ({
        id: group.id,
        kinds: group.kinds.filter(matches)
    })).filter((group) => group.kinds.length > 0);
    const shown: string[] = groups.flatMap((group) => [...group.kinds]);
    // The pick follows the search: a filtered-out choice is never the one
    // Continue would take.
    const current = shown.includes(choice) ? choice : shown[0];

    const move = (step: number) => {
        if (!current) return;
        const index = shown.indexOf(current);
        const next = shown[(index + step + shown.length) % shown.length];
        onChoose(next);
        groupRef.current
            ?.querySelector<HTMLElement>(`[data-kind="${next}"]`)
            ?.focus();
    };
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        // Enter on a kind picks it — a radio is a button, which would only
        // select it again.
        if (event.key === 'Enter') {
            event.preventDefault();
            if (current) onContinue();
            return;
        }
        const step = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1
        }[event.key];
        if (step === undefined) return;
        event.preventDefault();
        move(step);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!current) return;
        if (current !== choice) onChoose(current);
        onContinue();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
                <form onSubmit={submit} className="flex min-h-0 flex-col">
                    <DialogHeader className="gap-1 px-5 pb-3 pt-5">
                        <DialogTitle>
                            {intl.formatMessage(messages.title, {
                                type: typeLabel
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {intl.formatMessage(messages.description)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative px-5 pb-2">
                        <Search
                            className="pointer-events-none absolute left-7.5 top-1/2 size-4 -translate-y-[calc(50%+4px)] text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            type="search"
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={intl.formatMessage(messages.search)}
                            aria-label={intl.formatMessage(
                                messages.searchLabel
                            )}
                            className="pl-8"
                        />
                    </div>
                    <div
                        ref={groupRef}
                        role="radiogroup"
                        aria-label={intl.formatMessage(messages.group)}
                        onKeyDown={onKey}
                        className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-2"
                    >
                        {groups.map((group) => (
                            <section
                                key={group.id}
                                aria-labelledby={`kind-group-${group.id}`}
                                className="flex flex-col gap-2"
                            >
                                <h3
                                    id={`kind-group-${group.id}`}
                                    className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                                >
                                    {intl.formatMessage(messages[group.id])}
                                </h3>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {group.kinds.map((id) => (
                                        <FieldKindTile
                                            key={id}
                                            entry={catalogEntry(id)}
                                            selected={id === current}
                                            onSelect={() => onChoose(id)}
                                            onConfirm={() => {
                                                onChoose(id);
                                                onContinue();
                                            }}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {shown.length === 0 && (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                {intl.formatMessage(messages.none)}
                            </p>
                        )}
                    </div>
                    <DialogFooter className="items-center border-t px-5 py-3 sm:justify-between">
                        <p className="hidden text-xs text-muted-foreground sm:block">
                            {intl.formatMessage(messages.keys)}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                            >
                                {intl.formatMessage(messages.cancel)}
                            </Button>
                            <Button type="submit" disabled={!current}>
                                {intl.formatMessage(messages.next)}
                                <ArrowRight />
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
