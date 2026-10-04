import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { StructureRule } from './index';

const renderRule = (structure?: 'on' | 'off') => {
    const onChange = vi.fn();
    render(
        <IntlProvider locale="en">
            <StructureRule structure={structure} onChange={onChange} />
        </IntlProvider>
    );
    const toggle = screen.getByRole('switch', {
        name: 'Check the text’s structure'
    });
    return { onChange, toggle };
};

describe('StructureRule', () => {
    it('shows the check as on when the option is unset — the DSL default', () => {
        const { toggle } = renderRule(undefined);
        expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('writes only the opt-out, and clears it when the check is turned back on', () => {
        const { onChange, toggle } = renderRule(undefined);
        fireEvent.click(toggle);
        expect(onChange).toHaveBeenLastCalledWith({ structure: 'off' });
    });

    it('reads an explicit off as off, and turning it on unsets the option', () => {
        const { onChange, toggle } = renderRule('off');
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        fireEvent.click(toggle);
        expect(onChange).toHaveBeenLastCalledWith({ structure: undefined });
    });
});
