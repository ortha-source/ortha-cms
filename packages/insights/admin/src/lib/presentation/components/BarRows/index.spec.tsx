import { render, screen } from '@testing-library/react';
import { BarRows } from './index';
import type { BarRowSpec } from './index';

/**
 * The split bar's zero segment — drawn or not, named or not.
 *
 * The e2e suite's fixture cannot state this: it seeds a workspace whose locales
 * all have something missing, so "the missing hue is absent" and "the missing
 * hue is a 3px sliver" render the same page. Here the row is built with an
 * explicit zero, which is the only shape that tells the two apart.
 */
const coverage: BarRowSpec[] = [
    {
        id: 'fr',
        label: 'French',
        segments: [
            {
                id: 'translated',
                value: 12,
                tone: 'series-1',
                label: '12 translated'
            },
            { id: 'missing', value: 0, tone: 'series-2', label: '0 missing' }
        ],
        readout: '12'
    },
    {
        id: 'de',
        label: 'German',
        segments: [
            {
                id: 'translated',
                value: 7,
                tone: 'series-1',
                label: '7 translated'
            },
            { id: 'missing', value: 5, tone: 'series-2', label: '5 missing' }
        ],
        readout: '7'
    }
];

describe('BarRows zero segments', () => {
    it('draws nothing for a zero segment but still names it [insights:I-22]', () => {
        render(<BarRows rows={coverage} max={12} />);

        const complete = screen.getAllByRole('img')[0];

        // Segments carry a 3px floor so a small-but-real value stays visible.
        // Applied to a zero that floor draws a tick of the "missing" hue on a
        // locale with nothing missing — the chart stating the opposite of its
        // data — so the zero is filtered out before it is drawn.
        expect(complete.children).toHaveLength(1);
        expect((complete.children[0] as HTMLElement).style.width).toBe('100%');

        // Dropped from the drawing, kept in the name: "0 missing" is
        // information the bar cannot draw but the row still means, and the
        // readout column states only the first series.
        expect(complete.getAttribute('aria-label')).toBe(
            '12 translated. 0 missing'
        );
    });

    it('still draws a segment that is merely small [insights:I-22]', () => {
        render(<BarRows rows={coverage} max={12} />);

        const partial = screen.getAllByRole('img')[1];

        expect(partial.children).toHaveLength(2);
        expect(partial.getAttribute('aria-label')).toBe(
            '7 translated. 5 missing'
        );
    });
});
