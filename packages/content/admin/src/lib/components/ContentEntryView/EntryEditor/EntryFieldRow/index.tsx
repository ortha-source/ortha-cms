import { cn } from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { EntryFieldInput } from '../../../EntryFieldInput';

/**
 * One field line in the record editor's form island: the active-indicator
 * border + a scroll anchor (`f-<name>`, `scroll-margin-top`) wrapping the shared
 * {@link EntryFieldInput}. The input owns its own label / helper / error, so the
 * row is layout only — the outline's jump lands on the anchor, and focusing any
 * control inside it activates the row (via the pane's focus handler reading
 * `data-field-key`).
 */
export function EntryFieldRow({
    field,
    value,
    error,
    active,
    onChange,
    onBlur
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    active: boolean;
    onChange: (value: unknown) => void;
    onBlur: () => void;
}) {
    return (
        <div
            id={`f-${field.name}`}
            data-field-key={field.name}
            className={cn(
                '-ml-[18px] scroll-mt-[90px] border-l-2 pl-4',
                active ? 'border-foreground' : 'border-transparent'
            )}
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
