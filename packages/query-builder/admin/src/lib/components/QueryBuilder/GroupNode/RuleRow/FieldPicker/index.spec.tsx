import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIELDS, renderIntl } from '../../../../__test__/harness';
import { FieldPicker } from '.';

/**
 * The picker's listbox semantics. A browser test can see the highlight move;
 * what it cannot cheaply see is whether the move was *announced* — which is the
 * whole of the invariant, since focus deliberately never leaves the search box
 * and an unannounced highlight is a purely visual state.
 */

/** Open the picker and hand back its listbox. */
function openPicker(onChange = vi.fn()) {
    renderIntl(
        <FieldPicker fields={FIELDS} value="title" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('combobox'));
    return {
        listbox: screen.getByRole('listbox'),
        search: screen.getByRole('textbox', {
            name: 'Search fields and relations'
        }),
        onChange
    };
}

describe('FieldPicker', () => {
    it('makes every navigable row an option and every heading presentational [query-builder:I-19]', () => {
        const { listbox } = openPicker();

        // The fixture has all three shapes of row: the collection's own
        // scalars, a plugin's named category, and a collapsed relation. Each
        // heading is `presentation` because a listbox admits only
        // `option`/`group` children — plain text there is an invalid node in
        // the accessibility tree rather than a heading nobody reads.
        const roles = Array.from(listbox.children).map((el) =>
            el.getAttribute('role')
        );
        expect(roles).toEqual([
            'presentation', // Fields
            'option', // Title
            'option', // Views
            'option', // Published at
            'presentation', // Segmentation
            'option', // Can be seen by
            'presentation', // Relations
            'option' // Author (collapsed relation)
        ]);
        // No row is in the tab order: Tab leaves the popover instead of walking
        // every field in the schema.
        expect(
            within(listbox)
                .getAllByRole('option')
                .every((o) => o.getAttribute('tabindex') === '-1')
        ).toBe(true);
    });

    it('gives the relation row aria-expanded instead of a selected state [query-builder:I-19]', () => {
        const { listbox } = openPicker();

        const relation = within(listbox).getByRole('option', {
            name: 'Expand Author'
        });
        expect(relation.getAttribute('aria-expanded')).toBe('false');
        // A relation is never a value, so it is never the selected option —
        // that is what tells it apart from a field row for a reader who only
        // hears the two attributes.
        expect(relation.getAttribute('aria-selected')).toBe('false');

        fireEvent.click(relation);
        expect(
            within(screen.getByRole('listbox'))
                .getByRole('option', { name: 'Collapse Author' })
                .getAttribute('aria-expanded')
        ).toBe('true');
    });

    it('keeps focus on the search box and announces the highlight through it [query-builder:I-19]', () => {
        const { listbox, search } = openPicker();

        const options = () =>
            within(screen.getByRole('listbox')).getAllByRole('option');

        // Opening lands on the first navigable row, not on the header above it.
        expect(search.getAttribute('aria-controls')).toBe(listbox.id);
        expect(search.getAttribute('aria-activedescendant')).toBe(
            options()[0].id
        );

        fireEvent.keyDown(listbox, { key: 'ArrowDown' });

        // Focus has not moved — so `aria-activedescendant` is the only thing
        // that can tell assistive technology the highlight did.
        expect(document.activeElement).toBe(search);
        expect(search.getAttribute('aria-activedescendant')).toBe(
            options()[1].id
        );

        // …and it walks *past* the headings rather than pointing at one.
        fireEvent.keyDown(listbox, { key: 'ArrowDown' });
        fireEvent.keyDown(listbox, { key: 'ArrowDown' });
        const active = search.getAttribute('aria-activedescendant');
        expect(options().map((o) => o.id)).toContain(active);
        expect(
            document.getElementById(active as string)?.getAttribute('role')
        ).toBe('option');
    });

    it('wraps the highlight round the ends of the list [query-builder:I-19]', () => {
        const { listbox, search } = openPicker();

        const options = () =>
            within(screen.getByRole('listbox')).getAllByRole('option');

        fireEvent.keyDown(listbox, { key: 'ArrowUp' });

        // Up from the first row reaches the last option, not the last *row*
        // (which is what a naive index step lands on when the list ends in a
        // heading) and not a dead stop at the top.
        expect(search.getAttribute('aria-activedescendant')).toBe(
            options().at(-1)?.id
        );
    });
});
