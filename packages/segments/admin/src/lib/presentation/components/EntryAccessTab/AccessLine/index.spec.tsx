import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { EntryAccess } from '../../../../domain/types';
import { AccessLine } from './index';

const ids = (count: number, prefix: string) =>
    Array.from({ length: count }, (_unused, index) => `${prefix}-${index}`);

function draw(
    access: EntryAccess,
    props: { dirty?: boolean; onToggleRules?: () => void } = {}
) {
    return render(
        <IntlProvider locale="en">
            <AccessLine
                access={access}
                dirty={props.dirty ?? false}
                rulesOpen={false}
                onToggleRules={props.onToggleRules ?? vi.fn()}
                rulesId="rules"
            />
        </IntlProvider>
    );
}

const line = () => screen.getByTestId('access-line').textContent;

describe('AccessLine', () => {
    it('says public when nothing is set', () => {
        draw({ allow: [], deny: [] });
        expect(line()).toBe(
            'Public — every reader can see it. How rules combine'
        );
    });

    it('counts the excluded audiences when only "Cannot see" is set', () => {
        draw({ allow: [], deny: ids(5, 'd') });
        expect(line()).toBe(
            'Everyone except 5 audiences can see it. How rules combine'
        );
    });

    it('states the "Not set" rule once anything can see it', () => {
        draw({ allow: ids(1, 'a'), deny: [] });
        expect(line()).toBe(
            'Only 1 audience can see it — “Not set” counts as “Cannot see”. How rules combine'
        );
    });

    it('needs no words for the excluded ones beside an allow list', () => {
        draw({ allow: ids(8, 'a'), deny: ids(5, 'd') });
        expect(line()).toBe(
            'Only 8 audiences can see it — “Not set” counts as “Cannot see”. How rules combine'
        );
    });

    it('carries "Changed" while something is staged', () => {
        draw({ allow: [], deny: [] }, { dirty: true });
        expect(line()).toContain('Changed');
    });

    it('opens "How rules combine" as a disclosure', () => {
        const onToggleRules = vi.fn();
        draw({ allow: [], deny: [] }, { onToggleRules });
        const toggle = screen.getByRole('button', {
            name: 'How rules combine'
        });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('aria-controls')).toBe('rules');
        fireEvent.click(toggle);
        expect(onToggleRules).toHaveBeenCalled();
    });
});
