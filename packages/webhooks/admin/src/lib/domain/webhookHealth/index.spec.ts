import type { WebhookDelivery } from '../types/webhook';
import { deliveryOutcome, successRate, webhookState } from './index';

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
