/** Props for {@link PickerHeader}. */
export type PickerHeaderProps = {
    /** Id the section's `role="group"` is labelled by. */
    id: string;
    /** The kicker, e.g. "Collections". */
    title: string;
    /** The quiet right-hand note, e.g. "3 of 6". */
    note: string;
};

/**
 * One section's header row inside the content list: an uppercase kicker on a
 * muted band with a note at the end. The kicker names the section's group.
 */
export function PickerHeader({ id, title, note }: PickerHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-2 text-xs">
            <span
                id={id}
                className="font-medium tracking-wide text-muted-foreground uppercase"
            >
                {title}
            </span>
            <span className="text-muted-foreground">{note}</span>
        </div>
    );
}
