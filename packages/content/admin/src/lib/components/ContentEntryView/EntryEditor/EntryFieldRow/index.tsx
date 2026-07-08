import { cn } from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { EntryFieldInput } from '../../../EntryFieldInput';

/**
 * One field cell in the record editor's form island: a scroll anchor
 * (`f-<name>`, `scroll-margin-top`) wrapping the shared {@link EntryFieldInput}.
 * The input owns its own label / helper / error, so this is layout only — the
 * field navigator's jump lands on the anchor, and focusing any control inside it
 * activates the field (via the pane's focus handler reading `data-field-key`).
 * `className` lets the caller make the cell a flex item (the scalar grid grows
 * cells to fill their row).
 */
export function EntryFieldRow({
    field,
    value,
    error,
    onChange,
    onBlur,
    className
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    className?: string;
}) {
    return (
        <div
            id={`f-${field.name}`}
            data-field-key={field.name}
            className={cn('scroll-mt-[90px]', className)}
        >
            <EntryFieldInput
                field={field}
                value={value}
                error={error}
                onChange={onChange}
                onBlur={onBlur}
            />
        </div>
    );
}
