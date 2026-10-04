import {
    AlignLeft,
    Braces,
    Calendar,
    CalendarClock,
    CircleDollarSign,
    Hash,
    Image,
    Link2,
    List,
    ListChecks,
    ToggleLeft,
    Type,
    type LucideIcon
} from 'lucide-react';
import type { FieldDocType } from '@orthacms/schema-builder-domain';

/** One icon per field type — every type in the DSL, checked by the compiler. */
const ICONS: Record<FieldDocType, LucideIcon> = {
    text: Type,
    richtext: AlignLeft,
    number: Hash,
    money: CircleDollarSign,
    boolean: ToggleLeft,
    date: Calendar,
    datetime: CalendarClock,
    select: List,
    multiselect: ListChecks,
    json: Braces,
    relation: Link2,
    media: Image
};

/** The field type as a tile; decorative — the row names the type in words. */
export function FieldTypeIcon({ type }: { type: FieldDocType }) {
    const Icon = ICONS[type];
    return (
        <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
        >
            <Icon className="size-3.5" />
        </span>
    );
}
