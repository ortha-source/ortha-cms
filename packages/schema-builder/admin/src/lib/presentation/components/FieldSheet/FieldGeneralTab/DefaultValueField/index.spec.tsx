import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDoc } from '@orthacms/schema-builder-domain';
import { DefaultValueField } from './index';

const HINT =
    'Pre-fills the form when someone creates an entry. Entries that already exist, and entries created through the API, are not changed.';

const renderField = (spec: FieldDoc) => {
    const onChange = vi.fn();
    const view = render(
        <IntlProvider locale="en">
            <DefaultValueField spec={spec} onChange={onChange} />
        </IntlProvider>
    );
    return { onChange, ...view };
};

describe('DefaultValueField', () => {
    it('says under the control that it is a prefill, and ties the hint to it', () => {
        renderField({ type: 'text' });
        const input = screen.getByLabelText('Default value');
        expect(screen.getByText(HINT).id).toBe('field-default-hint');
        expect(input.getAttribute('aria-describedby')).toContain(
            'field-default-hint'
        );
    });

    it('is not offered on a relation, media, rich text or json field', () => {
        for (const spec of [
            { type: 'relation', to: 'author' },
            { type: 'media' },
            { type: 'richtext' },
            { type: 'json' }
        ] as FieldDoc[]) {
            const { container, unmount } = renderField(spec);
            expect(container.textContent).toBe('');
            unmount();
        }
    });

    it('writes a typed text default, and an emptied box clears it', () => {
        const { onChange } = renderField({
            type: 'text',
            defaultValue: 'Untitled'
        });
        const input = screen.getByLabelText<HTMLInputElement>('Default value');
        expect(input.value).toBe('Untitled');
        fireEvent.change(input, { target: { value: '' } });
        expect(onChange).toHaveBeenLastCalledWith({ defaultValue: '' });
    });

    it('writes a number default as a number', () => {
        const { onChange } = renderField({ type: 'number' });
        fireEvent.change(screen.getByLabelText('Default value'), {
            target: { value: '3' }
        });
        expect(onChange).toHaveBeenLastCalledWith({ defaultValue: 3 });
    });

    it('ticks a multiselect default in the options’ order, and none ticked clears it', () => {
        const { onChange, rerender } = renderField({
            type: 'multiselect',
            options: ['a', 'b', 'c'],
            defaultValue: ['c']
        });
        fireEvent.click(screen.getByRole('checkbox', { name: 'a' }));
        expect(onChange).toHaveBeenLastCalledWith({ defaultValue: ['a', 'c'] });
        rerender(
            <IntlProvider locale="en">
                <DefaultValueField
                    spec={{
                        type: 'multiselect',
                        options: ['a', 'b', 'c'],
                        defaultValue: ['c']
                    }}
                    onChange={onChange}
                />
            </IntlProvider>
        );
        fireEvent.click(screen.getByRole('checkbox', { name: 'c' }));
        expect(onChange).toHaveBeenLastCalledWith({ defaultValue: undefined });
    });

    it('shows the date box only for a fixed date', () => {
        renderField({ type: 'date', defaultValue: 'today' });
        expect(screen.queryByLabelText('Date')).toBeNull();
    });

    it('shows a fixed date in the date box', () => {
        renderField({ type: 'date', defaultValue: '2026-01-31' });
        expect(screen.getByLabelText<HTMLInputElement>('Date').value).toBe(
            '2026-01-31'
        );
    });
});
