import { useEffect } from 'react';
import { WysiwygField } from '@ortha-cms/wysiwyg-admin';
import { useWorkAreaRegion } from '../../../hooks/useWorkAreaRegion';

/**
 * The `wysiwyg` field's control, wired to the page's **work-area region**: the
 * preview sits in the form, and expanding it hands the editor the whole work
 * area (the sidebar, top bar and the record's tabs stay; every other field goes
 * away for the duration).
 *
 * It is its own component rather than a branch inside `EntryFieldInput` because
 * it needs hooks, and that component is a `switch` that returns early — a hook
 * there would run conditionally. Outside this page there is no region, and
 * `WysiwygField` falls back to expanding in place.
 */
export function WysiwygFieldControl({
    id,
    label,
    value,
    invalid,
    describedBy,
    onChange,
    onBlur
}: {
    id: string;
    label: string;
    value: string;
    invalid: boolean;
    describedBy?: string;
    onChange(value: string): void;
    onBlur?(): void;
}) {
    const { host, setFilled } = useWorkAreaRegion();

    // A record that navigates away mid-edit (the i18n locale switch remounts
    // the whole editor) must not leave the page showing an empty region over a
    // hidden form.
    useEffect(() => () => setFilled(false), [setFilled]);

    return (
        <WysiwygField
            id={id}
            label={label}
            value={value}
            invalid={invalid}
            aria-describedby={describedBy}
            expandTo={host}
            onExpandedChange={setFilled}
            onChange={onChange}
            onBlur={onBlur}
        />
    );
}
