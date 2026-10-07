import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { LocaleSyncSelect } from './index';

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
}

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
}

const NAMES = { source: 'Article', target: 'Author' };

const renderSelect = (
    props: {
        syncAcrossLocales?: boolean;
        localized?: boolean;
        targetI18n?: boolean;
    } = {}
) => {
    const onChange = vi.fn();
    render(
        <IntlProvider locale="en">
            <LocaleSyncSelect
                syncAcrossLocales={props.syncAcrossLocales}
                localized={props.localized}
                targetI18n={props.targetI18n ?? false}
                names={NAMES}
                onChange={onChange}
            />
        </IntlProvider>
    );
    const trigger = screen.getByRole('combobox', {
        name: 'Links in translations'
    });
    return { onChange, trigger };
};

describe('LocaleSyncSelect', () => {
    it('reads an unset option as one shared link when the target is not translated', () => {
        const { trigger } = renderSelect();
        expect(trigger.textContent).toBe('The same Author in every locale');
        expect(trigger.getAttribute('aria-describedby')).toBe(
            'relation-locale-sync-hint'
        );
        expect(
            screen.getByText(/one link fits every locale/).textContent
        ).toContain('Every translation of a Article entry');
    });

    it('names the per-locale translation, and says what a missing one does, when the target is translated', () => {
        const { trigger } = renderSelect({ targetI18n: true });
        expect(trigger.textContent).toBe(
            'The Author translation in each locale'
        );
        expect(screen.getByText(/goes without the link/).textContent).toContain(
            'Nothing is translated or created for you'
        );
    });

    it('reads localized: true as set separately', () => {
        const { trigger } = renderSelect({ localized: true, targetI18n: true });
        expect(trigger.textContent).toBe('Set separately in each locale');
        expect(screen.queryByText(/goes without the link/)).toBeNull();
    });

    it('writes only the opt-out, clearing localized', () => {
        const { onChange, trigger } = renderSelect();
        fireEvent.keyDown(trigger, { key: 'Enter' });
        fireEvent.click(
            screen.getByRole('option', {
                name: 'Set separately in each locale'
            })
        );
        expect(onChange).toHaveBeenLastCalledWith({
            syncAcrossLocales: false,
            localized: undefined
        });
    });

    it('turning sync back on unsets both flags — the DSL default', () => {
        const { onChange, trigger } = renderSelect({ localized: true });
        fireEvent.keyDown(trigger, { key: 'Enter' });
        fireEvent.click(
            screen.getByRole('option', {
                name: 'The same Author in every locale'
            })
        );
        expect(onChange).toHaveBeenLastCalledWith({
            syncAcrossLocales: undefined,
            localized: undefined
        });
    });
});
