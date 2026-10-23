import type { WebhookDelivery } from '../types/webhook';
import {
    deliveryOutcome,
    medianDuration,
    successRate,
    webhookState
} from './index';

const delivery = (status: WebhookDelivery['status']) =>
    ({ id: status, status }) as WebhookDelivery;

describe('webhookState', () => {
    it('tells a paused endpoint from one the worker stopped', () => {
        expect(webhookState({ enabled: true, disabledReason: null })).toBe(
            'active'
        );
        expect(webhookState({ enabled: false, disabledReason: null })).toBe(
            'paused'
        );
        expect(
            webhookState({ enabled: false, disabledReason: '20 failures' })
        ).toBe('stopped');
    });
});

describe('successRate', () => {
    it('counts only finished deliveries', () => {
        expect(
            successRate([
                delivery('succeeded'),
                delivery('dead'),
                delivery('pending')
            ])
        ).toBe(50);
    });

    it('claims no rate over nothing finished', () => {
        expect(successRate([])).toBeNull();
        expect(successRate([delivery('delivering')])).toBeNull();
    });

    it('reads a retrying delivery as failed so far', () => {
        expect(deliveryOutcome('failed')).toBe('failed');
    });
});

describe('medianDuration', () => {
    const timed = (durationMs: number | null) =>
        ({ id: String(durationMs), durationMs }) as WebhookDelivery;

    it('takes the middle of the deliveries that were answered', () => {
        expect(medianDuration([timed(300), timed(100), timed(null)])).toBe(200);
        expect(medianDuration([timed(5), timed(100), timed(900)])).toBe(100);
    });

    it('is nothing over nothing', () => {
        expect(medianDuration([timed(null)])).toBeNull();
    });
});
