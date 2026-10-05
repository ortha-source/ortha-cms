import { useState, type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@orthacms/design-system';
import { OP, type FilterGroup } from '../../types/filter-tree.type';
import { FIELDS, group, renderIntl, rule } from '../__test__/harness';
import { QueryBuilderPopover, type QueryBuilderPopoverProps } from '.';

/**
 * The staged draft's lifecycle, and the popover around it. The popover is not
 * a controlled component all the way down — it holds the edits until Apply — so
 * the one thing that can go wrong invisibly is the draft outliving the surface
 * it was typed into: reopen it and edit yesterday's abandoned rule while the
 * table shows today's filter.
 */

/** The popover as a list page mounts it: the page owns the applied value. */
function Host({
    initial,
    onApply = vi.fn(),
    ...rest
}: {
    initial: FilterGroup | null;
    onApply?: (next: FilterGroup | null) => void;
} & Partial<Omit<QueryBuilderPopoverProps, 'value' | 'onApply'>>) {
    const [value, setValue] = useState<FilterGroup | null>(initial);
    return (
        <QueryBuilderPopover
            fields={FIELDS}
            {...rest}
            value={value}
            onApply={(next) => {
                setValue(next);
                onApply(next);
            }}
        />
    );
}

/** Tooltips need their provider, which the host app mounts once. */
function renderHost(ui: ReactElement) {
    return renderIntl(<TooltipProvider>{ui}</TooltipProvider>);
}

const valueInput = () =>
    screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement;
const trigger = () => screen.getByRole('button', { name: /^Filters/ });
const dialog = () => screen.queryByRole('dialog', { name: 'Filters' });
const open = () => {
    fireEvent.click(trigger());
    expect(dialog()).not.toBeNull();
};
const pressEscape = () =>
    fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape'
    });

describe('QueryBuilderPopover', () => {
    it('is an icon button named by the applied-rule count', () => {
        renderHost(
            <Host
                initial={group('root', [
                    rule('r1', 'title', OP.Contains, 'alpha'),
                    rule('r2', 'views', OP.Gt, '3')
                ])}
            />
        );

        // The count is in the name as words, not only in a badge a screen
        // reader never hears.
        expect(trigger().getAttribute('aria-label')).toBe('Filters, 2 applied');
        expect(screen.getByTestId('qb-filter-count').textContent).toBe('2');
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('drops the count when nothing is applied', () => {
        renderHost(<Host initial={null} />);

        expect(trigger().getAttribute('aria-label')).toBe('Filters');
        expect(screen.queryByTestId('qb-filter-count')).toBeNull();
    });

    it('opens a dialog named by its heading, which the trigger controls', () => {
        renderHost(<Host initial={null} />);
        open();

        const surface = dialog() as HTMLElement;
        expect(trigger().getAttribute('aria-expanded')).toBe('true');
        expect(trigger().getAttribute('aria-controls')).toBe(surface.id);
        expect(surface.getAttribute('aria-labelledby')).toBe(
            screen.getByRole('heading', { name: 'Filters' }).id
        );
    });

    it('lands focus on the first condition’s field cell', async () => {
        renderHost(
            <Host
                initial={group('root', [
                    rule('r1', 'title', OP.Contains, 'alpha')
                ])}
            />
        );
        open();

        await waitFor(() =>
            expect(document.activeElement?.getAttribute('role')).toBe(
                'combobox'
            )
        );
    });

    it('closes on Escape and hands focus back to the trigger', async () => {
        renderHost(<Host initial={null} />);
        open();

        pressEscape();

        await waitFor(() => expect(dialog()).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(trigger()));
    });

    it('discards an un-applied edit when it is closed and reopened [query-builder:I-14]', async () => {
        renderHost(
            <Host
                initial={group('root', [
                    rule('r1', 'title', OP.Contains, 'alpha')
                ])}
            />
        );
        open();

        expect(valueInput().value).toBe('alpha');
        fireEvent.change(valueInput(), { target: { value: 'beta' } });
        expect(valueInput().value).toBe('beta');

        // Closing without Apply. The resync on open is the only thing that
        // puts the user back on the filter the table is actually showing.
        pressEscape();
        await waitFor(() => expect(dialog()).toBeNull());
        open();

        expect(valueInput().value).toBe('alpha');
    });

    it('commits on Apply and closes, then re-reads the applied filter [query-builder:I-14]', async () => {
        const onApply = vi.fn();
        const onApplied = vi.fn();
        renderHost(
            <Host
                initial={group('root', [
                    rule('r1', 'title', OP.Contains, 'alpha')
                ])}
                onApply={onApply}
                onApplied={onApplied}
            />
        );
        open();

        fireEvent.change(valueInput(), { target: { value: 'gamma' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onApplied).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(dialog()).toBeNull());

        // Applied, so this *is* the current filter; the draft must survive the
        // trip rather than snap back to what the popover opened on.
        open();
        expect(valueInput().value).toBe('gamma');
    });

    it('keeps the popover open and shows the errors when Apply is refused', () => {
        const onApply = vi.fn();
        renderHost(
            <Host
                initial={group('root', [rule('r1', 'title', OP.Contains, '')])}
                onApply={onApply}
            />
        );
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(onApply).not.toHaveBeenCalled();
        expect(dialog()).not.toBeNull();
        expect(screen.getByTestId('qb-rule-error').textContent).toContain(
            'Value required'
        );
    });

    it('clears the previous attempt’s error state on reopening [query-builder:I-14]', async () => {
        renderHost(
            <Host
                initial={group('root', [rule('r1', 'title', OP.Contains, '')])}
            />
        );
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(screen.getByTestId('qb-rule-error')).toBeTruthy();

        pressEscape();
        await waitFor(() => expect(dialog()).toBeNull());
        open();

        // The rule is still incomplete — it is the same rule. What must not
        // survive is the *shaming*: a reopened popover is a fresh draft, and
        // the user has not pressed Apply on it.
        expect(screen.queryByTestId('qb-rule-error')).toBeNull();
    });

    it('commits "no filter" on Reset and stays open for the next one', () => {
        const onApply = vi.fn();
        renderHost(
            <Host
                initial={group('root', [
                    rule('r1', 'title', OP.Contains, 'alpha')
                ])}
                onApply={onApply}
            />
        );
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

        expect(onApply).toHaveBeenCalledWith(null);
        expect(dialog()).not.toBeNull();
        expect(screen.queryByRole('textbox', { name: 'Value' })).toBeNull();
    });

    it('waits for fetched fields instead of drawing a dead builder', () => {
        renderHost(<Host initial={null} fieldsPending />);
        open();

        expect(screen.getByText('Loading filterable fields…')).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Apply'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        // Clearing an applied filter needs no definitions.
        expect(
            (
                screen.getByRole('button', {
                    name: 'Reset'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
    });

    it('explains a failed field surface and offers a retry', () => {
        const onRetryFields = vi.fn();
        renderHost(
            <Host initial={null} fieldsError onRetryFields={onRetryFields} />
        );
        open();

        expect(screen.getByRole('alert').textContent).toContain(
            "Couldn't load the filterable fields"
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(onRetryFields).toHaveBeenCalledTimes(1);
    });

    it('takes a custom trigger and names the surface after it', () => {
        renderHost(
            <Host
                initial={null}
                title="Edit conditions"
                trigger={<button type="button">Edit conditions</button>}
            />
        );

        const custom = screen.getByRole('button', { name: 'Edit conditions' });
        fireEvent.click(custom);

        expect(custom.getAttribute('aria-expanded')).toBe('true');
        expect(
            screen.getByRole('dialog', { name: 'Edit conditions' })
        ).toBeTruthy();
    });
});
