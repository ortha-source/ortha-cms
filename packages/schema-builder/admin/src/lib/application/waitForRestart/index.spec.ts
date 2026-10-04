import { describe, expect, it, vi } from 'vitest';
import type { SchemaGateway } from '../../domain/schemaGateway';
import { waitForRestart } from './index';

const envelope = (bootId: string) => ({ bootId }) as never;
const sleep = vi.fn(async () => undefined);

describe('waitForRestart', () => {
    it('waits past the old process and the outage to a new boot id', async () => {
        const document = vi
            .fn()
            .mockResolvedValueOnce(envelope('old'))
            .mockRejectedValueOnce(new Error('502'))
            .mockResolvedValueOnce(envelope('new'));
        await expect(
            waitForRestart({ document } as unknown as SchemaGateway, 'old', {
                sleep
            })
        ).resolves.toEqual({ bootId: 'new' });
    });

    it('gives up at the deadline, saying what to do', async () => {
        const document = vi.fn().mockResolvedValue(envelope('old'));
        await expect(
            waitForRestart({ document } as unknown as SchemaGateway, 'old', {
                sleep,
                intervalMs: 10,
                timeoutMs: 20
            })
        ).rejects.toThrow(/Restart it, then reload/);
    });
});
