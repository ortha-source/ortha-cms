import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './input';
import { SegmentedControl, SegmentedControlItem } from './segmented-control';

/**
 * ORT-204 — the boolean field's control has to be shaped like a field.
 *
 * `SegmentedControl` does two jobs: a toolbar switch (AND/OR, Open/Rules) and
 * the entry editor's boolean field. The second sits in a column of `Input`s and
 * `SelectTrigger`s, and the difference between its `rounded-xl border` and
 * their `rounded-lg border-input` is exactly one field looking foreign in a
 * form — the tokens are deliberately different values (`--color-input` is a
 * step darker than `--color-border`, so an editable surface reads as editable),
 * so this is not a cosmetic near-miss.
 *
 * Asserted against `Input`'s own classes rather than against literals: what
 * matters is that the two agree, and a spec pinning `rounded-lg` twice would
 * keep passing after someone restyled every input in the library.
 */
describe('SegmentedControl', () => {
    /** The classes `Input` — the reference form control — carries. */
    function inputClasses(): string {
        const { container } = render(<Input aria-label="Reference" />);
        return container.firstElementChild?.className ?? '';
    }

    // Read off the rendered root rather than by role: Radix maps a
    // `type="single"` toggle group to `radiogroup`, and what is under test here
    // is the box's own classes, not its semantics.
    function segmentedClasses(variant?: 'toolbar' | 'field'): string {
        const { container } = render(
            <SegmentedControl
                variant={variant}
                aria-label="Enabled"
                value="on"
                onValueChange={() => undefined}
            >
                <SegmentedControlItem value="on">Enabled</SegmentedControlItem>
                <SegmentedControlItem value="off">
                    Disabled
                </SegmentedControlItem>
            </SegmentedControl>
        );
        return container.firstElementChild?.className ?? '';
    }

    it('matches the reference form control on radius and border in the field variant [design-system:I-41]', () => {
        const reference = inputClasses();
        const field = segmentedClasses('field');

        for (const token of ['rounded-lg', 'border-input']) {
            expect(`${token} on Input`).toBe(
                reference.includes(token)
                    ? `${token} on Input`
                    : `${token} missing from Input`
            );
            expect(`${token} on the field variant`).toBe(
                field.includes(token)
                    ? `${token} on the field variant`
                    : `${token} missing from the field variant`
            );
        }
    });

    // 36px, like every other control in a form column. The default is 38px
    // (2px border + 8px padding + a 28px item), which left the boolean field
    // standing two pixels proud of its neighbours.
    it('takes the form controls’ height in the field variant [design-system:I-41]', () => {
        expect(segmentedClasses('field')).toContain('h-9');
    });

    // The other five call sites are toolbars, and were not asking to be
    // restyled — a fix that changed the base class would have moved all of them.
    it('leaves the toolbar shape alone, and defaults to it [design-system:I-41]', () => {
        expect(segmentedClasses('toolbar')).toContain('rounded-xl');
        expect(segmentedClasses()).toContain('rounded-xl');
        expect(segmentedClasses()).not.toContain('border-input');
    });
});
