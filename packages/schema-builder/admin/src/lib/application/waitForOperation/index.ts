import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import type { SchemaGateway } from '../../domain/schemaGateway';
import { sleep as realSleep, type PollOptions } from '../polling';

/**
 * Resolves with the apply once it is no longer running. A request that fails
 * meanwhile is expected — the apply ends by restarting the server — so it is
 * retried, not reported; only the deadline gives up.
 */
export async function waitForOperation(
    gateway: SchemaGateway,
    id: string,
    {
        intervalMs = 750,
        timeoutMs = 5 * 60_000,
        sleep = realSleep
    }: PollOptions = {}
): Promise<ApplyOperation> {
    for (let waited = 0; waited <= timeoutMs; waited += intervalMs) {
        const operation = await gateway.operation(id).catch(() => null);
        if (operation && operation.status !== 'running') return operation;
        await sleep(intervalMs);
    }
    throw new Error('The apply did not finish in time. Check the server log.');
}
