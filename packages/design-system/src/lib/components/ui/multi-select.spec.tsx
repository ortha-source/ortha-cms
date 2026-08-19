import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MultiSelect, type MultiSelectOption } from './multi-select';

/**
 * QA ORT-49 · F12, EC-03 — `🐞 BUG-design-system-06` and
 * `♿ A11Y-design-system-02` (filed separately as ORT-128).
 *
 * The artifact records `MultiSelect` as "exported but unused"; it is not — the
 * API-token scope picker and the content entry's multi-value enum field both
 * mount it. cmdk keys, filters and highlights an item by its `value` prop, and
 * it *overwrites* any `aria-selected` a caller passes, so chosen-ness has to be
 * carried by something cmdk does not own.
 */
const options: MultiSelectOption[] = [
    { value: 'read', label: 'Read' },
    { value: 'write', label: 'Write' }
];

function open(trigger: HTMLElement) {
    fireEvent.click(trigger);
}

const trigger = () => screen.getByRole('combobox');

describe('MultiSelect', () => {
    it('shows the placeholder when nothing is selected', () => {
        render(
            <MultiSelect
                options={options}
                value={[]}
                onChange={() => undefined}
                placeholder="Pick scopes"
            />
        );

        expect(trigger().textContent).toContain('Pick scopes');
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('shows a badge per selected value, by label', () => {
        render(
            <MultiSelect
                options={options}
                value={['read', 'write']}
                onChange={() => undefined}
            />
        );

        expect(trigger().textContent).toContain('Read');
        expect(trigger().textContent).toContain('Write');
    });

    it('falls back to the raw value when no option matches it', () => {
        render(
            <MultiSelect
                options={options}
                value={['deleted-scope']}
                onChange={() => undefined}
            />
        );

        expect(trigger().textContent).toContain('deleted-scope');
    });

    it('adds and removes a value on toggle', async () => {
        const onChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                value={['read']}
                onChange={onChange}
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(2)
        );

        fireEvent.click(screen.getByRole('option', { name: /Write/ }));
        expect(onChange).toHaveBeenCalledWith(['read', 'write']);

        onChange.mockClear();
        fireEvent.click(screen.getByRole('option', { name: /Read/ }));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    // EC-03.
    it('renders the empty text with no options', async () => {
        render(
            <MultiSelect
                options={[]}
                value={[]}
                onChange={() => undefined}
                emptyText="Nothing here"
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getByText('Nothing here')).toBeTruthy()
        );
    });

    // BUG-design-system-06 — two options may legitimately share a label (two
    // collections both called "Posts"); they are still two options, and cmdk
    // identifies a row by the `value` it is given. Share that, and the two rows
    // become one as far as the highlight and the arrow keys are concerned.
    const duplicates: MultiSelectOption[] = [
        { value: 'blog:posts', label: 'Posts' },
        { value: 'news:posts', label: 'Posts' }
    ];

    it('highlights only one of two rows that share a label', async () => {
        render(
            <MultiSelect
                options={duplicates}
                value={[]}
                onChange={() => undefined}
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(2)
        );

        const highlighted = screen
            .getAllByRole('option')
            .filter((row) => row.getAttribute('aria-selected') === 'true');
        expect(highlighted).toHaveLength(1);
    });

    it('keeps two options with the same label independently chosen', async () => {
        render(
            <MultiSelect
                options={duplicates}
                value={['news:posts']}
                onChange={() => undefined}
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(2)
        );

        expect(
            screen
                .getAllByRole('option')
                .map((row) => row.getAttribute('aria-checked'))
        ).toEqual(['false', 'true']);
    });

    it('finds an option by searching its value as well as its label', async () => {
        render(
            <MultiSelect
                options={[
                    { value: 'content:publish', label: 'Publish content' },
                    { value: 'media:read', label: 'Read media' }
                ]}
                value={[]}
                onChange={() => undefined}
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(2)
        );

        fireEvent.change(screen.getByPlaceholderText('Search…'), {
            target: { value: 'media:' }
        });

        await waitFor(() =>
            expect(
                screen.getAllByRole('option').map((row) => row.textContent)
            ).toEqual(['Read media'])
        );
    });

    // ORT-128 / A11Y-design-system-02 — chosen-ness reached assistive tech only
    // as an `aria-hidden` check icon differing by opacity. cmdk owns
    // `aria-selected` (it tracks the highlight), so the chosen state is carried
    // by `aria-checked`, which `role="option"` supports and cmdk never sets.
    it('exposes the chosen rows, not the highlighted one', async () => {
        render(
            <MultiSelect
                options={options}
                value={['write']}
                onChange={() => undefined}
            />
        );

        open(trigger());
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(2)
        );

        expect(
            screen
                .getAllByRole('option')
                .map((row) => [
                    row.textContent,
                    row.getAttribute('aria-checked')
                ])
        ).toEqual([
            ['Read', 'false'],
            ['Write', 'true']
        ]);
    });

    it('declares the list multi-selectable', async () => {
        render(
            <MultiSelect
                options={options}
                value={[]}
                onChange={() => undefined}
            />
        );

        open(trigger());
        await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
        expect(
            screen.getByRole('listbox').getAttribute('aria-multiselectable')
        ).toBe('true');
    });

    it('tells assistive tech the trigger opens a listbox', () => {
        render(
            <MultiSelect
                options={options}
                value={[]}
                onChange={() => undefined}
            />
        );

        expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    });

    it('marks the trigger invalid and describes it on request', () => {
        render(
            <MultiSelect
                options={options}
                value={[]}
                onChange={() => undefined}
                invalid
                aria-describedby="scopes-error"
            />
        );

        expect(trigger().getAttribute('aria-invalid')).toBe('true');
        expect(trigger().getAttribute('aria-describedby')).toBe('scopes-error');
    });
});
