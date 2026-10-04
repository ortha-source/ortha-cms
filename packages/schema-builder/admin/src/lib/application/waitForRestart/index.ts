import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import type { SchemaGateway } from '../../domain/schemaGateway';
import { sleep as realSleep, type PollOptions } from '../polling';

/**
 * Resolves with the restarted server's document, once its boot id differs
 * from `oldBootId`. A 200 alone is not the signal — the old process answers
 * until it is replaced — and the errors while it is down are expected.
 */
export async function waitForRestart(
    gateway: SchemaGateway,
    oldBootId: string,
    {
        intervalMs = 1_000,
        timeoutMs = 2 * 60_000,
        sleep = realSleep
    }: PollOptions = {}
): Promise<SchemaDocumentEnvelope> {
    for (let waited = 0; waited <= timeoutMs; waited += intervalMs) {
        const next = await gateway.document().catch(() => null);
        if (next && next.bootId !== oldBootId) return next;
        await sleep(intervalMs);
    }
    throw new Error(
        'The server did not come back in time. Restart it, then reload this page.'
    );
}
