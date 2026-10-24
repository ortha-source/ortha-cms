import { describe, expect, it } from 'vitest';
import type { InsightsSignal } from '../../presentation/slots/insightsSlots';
import { resolveInsightsSignals } from '.';

const signal = (id: string, extra: Partial<InsightsSignal> = {}) =>
    ({
        id,
        titleId: `t.${id}`,
        defaultTitle: id,
        Component: () => null,
        Drill: () => null,
        ...extra
    }) as InsightsSignal;

describe('resolveInsightsSignals', () => {
    it('drops a line whose permission the user lacks', () => {
        const ids = resolveInsightsSignals({
            signals: [
                signal('content', { permission: 'content:read' }),
                signal('media', { permission: 'media:read' }),
                signal('open')
            ],
            permissions: ['media:read']
        }).map((entry) => entry.id);
        expect(ids).toEqual(['media', 'open']);
    });

    it('orders by `order`, stable on a tie, unordered lines last', () => {
        const ids = resolveInsightsSignals({
            signals: [
                signal('late'),
                signal('b', { order: 20 }),
                signal('a', { order: 10 }),
                signal('b2', { order: 20 })
            ],
            permissions: []
        }).map((entry) => entry.id);
        expect(ids).toEqual(['a', 'b', 'b2', 'late']);
    });
});
