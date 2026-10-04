import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import { describe, expect, it, vi } from 'vitest';
import type { SchemaGateway } from '../../domain/schemaGateway';
import { waitForOperation } from './index';

const op = (status: ApplyOperation['status']): ApplyOperation => ({
    id: 'op',
    status,
    step: null,
    migrations: [],
    files: [],
    bootId: 'b',
    startedAt: ''
});
const sleep = vi.fn(async () => undefined);

describe('waitForOperation', () => {
    it('polls past running — and past the errors of a restarting server — to the outcome', async () => {
        const operation = vi
            .fn()
            .mockResolvedValueOnce(op('running'))
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce(op('succeeded'));
        const result = await waitForOperation(
            { operation } as unknown as SchemaGateway,
            'op',
            { sleep }
        );
        expect(result.status).toBe('succeeded');
        expect(operation).toHaveBeenCalledTimes(3);
    });

    it('answers a failure as soon as it is recorded', async () => {
        const operation = vi.fn().mockResolvedValue(op('failed'));
        await expect(
            waitForOperation({ operation } as unknown as SchemaGateway, 'op', {
                sleep
            })
        ).resolves.toMatchObject({ status: 'failed' });
    });

    it('gives up at the deadline', async () => {
        const operation = vi.fn().mockResolvedValue(op('running'));
        await expect(
            waitForOperation({ operation } as unknown as SchemaGateway, 'op', {
                sleep,
                intervalMs: 10,
                timeoutMs: 30
            })
        ).rejects.toThrow(/did not finish/);
        expect(operation).toHaveBeenCalledTimes(4);
    });
});
