import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import type { EntryAccess, Segment } from '../../../../domain/types';
import { AccessSummary } from './index';

/** `count` audiences, zero-padded so the alphabetical order is the numeric one. */
const audiences: Segment[] = Array.from({ length: 30 }, (_unused, index) => {
    const n = String(index + 1).padStart(2, '0');
    return {
        id: `seg-${n}`,
        key: `audience-${n}`,
        label: `Audience ${n}`,
        tags: [`audience-${n}`],
        workspaceIds: [],
        usageCount: 0
    };
});
const ids = (from: number, to: number) =>
    audiences.slice(from - 1, to).map((segment) => segment.id);

function draw(access: EntryAccess, known: Segment[] = audiences) {
    return render(
        <IntlProvider locale="en">
            <AccessSummary access={access} known={known} />
        </IntlProvider>
    );
}

const sentence = () => screen.getByTestId('access-summary').textContent;

describe('AccessSummary', () => {
    it('reads open access as everyone', () => {
        draw({ allow: [], deny: [] });
        expect(sentence()).toBe('Readable by everyone');
    });

    it('names a short side in full', () => {
        draw({ allow: ids(1, 2), deny: [] });
        expect(sentence()).toBe('Readable only by Audience 01 and Audience 02');
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('names three per side and counts the rest', () => {
        draw({ allow: ids(1, 8), deny: ids(9, 13) });
        expect(sentence()).toBe(
            'Readable only by Audience 01, Audience 02, Audience 03 and 5 more — never by Audience 09, Audience 10, Audience 11 and 2 more'
        );
    });

    it('keeps the deny-only wording', () => {
        draw({ allow: [], deny: ids(1, 5) });
        expect(sentence()).toBe(
            'Readable by everyone except Audience 01, Audience 02, Audience 03 and 2 more'
        );
    });

    it('opens the full lists from "and N more", and closes them again', () => {
        draw({ allow: ids(1, 8), deny: ids(9, 13) });
        const [more] = screen.getAllByRole('button', { name: /and \d+ more/ });
        expect(more.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(more);
        const full = screen.getByTestId('access-summary-full');
        expect(full.id).toBe(more.getAttribute('aria-controls'));
        expect(full.textContent).toContain(
            'Can see: Audience 01, Audience 02, Audience 03, Audience 04, Audience 05, Audience 06, Audience 07, and Audience 08'
        );
        expect(full.textContent).toContain('Cannot see: Audience 09,');
        // Both sides' buttons drive the one region.
        for (const button of screen.getAllByRole('button')) {
            expect(button.getAttribute('aria-expanded')).toBe('true');
        }

        fireEvent.click(more);
        expect(screen.queryByTestId('access-summary-full')).toBeNull();
    });

    it('counts audiences it cannot name rather than dropping them', () => {
        draw({ allow: ['gone-1', ...ids(1, 4)], deny: [] }, audiences);
        expect(sentence()).toBe(
            'Readable only by Audience 01, Audience 02, Audience 03 and 2 more'
        );
    });
});
