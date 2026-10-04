import {
    documentOf,
    envelopeOf,
    typeOf,
    withField
} from '../../../testing/documents';
import {
    CountingLock,
    MemoryOperationLog,
    statsOf
} from '../../../testing/fakes';
import {
    ApplyInProgressError,
    SchemaBlockedError,
    StaleDocumentError,
    UnconfirmedChangesError
} from '../../domain/errors';
import { ChangePlanner } from '../change-planner';
import type { LoadDocumentUseCase } from '../load-document.use-case';
import type { ApplyJob } from './apply-job';
import { ApplySchemaUseCase } from './apply-schema.use-case';

describe('ApplySchemaUseCase', () => {
    const tag = typeOf(
        'tag',
        { name: { type: 'text' }, legacy: { type: 'text' } },
        { publishable: false }
    );
    const current = envelopeOf(documentOf(tag));

    function setup(rows: Record<string, number> = {}) {
        const lock = new CountingLock();
        const log = new MemoryOperationLog();
        const job = { run: jest.fn(async () => undefined) };
        const load = { execute: async () => current } as LoadDocumentUseCase;
        const useCase = new ApplySchemaUseCase(
            load,
            new ChangePlanner(statsOf(rows)),
            job as unknown as ApplyJob,
            lock,
            log,
            'boot-1'
        );
        const apply = (
            document: unknown,
            extra: { confirmed?: string[]; baseFingerprint?: string } = {}
        ) =>
            useCase.execute(
                {
                    document,
                    baseFingerprint:
                        extra.baseFingerprint ?? current.fingerprint,
                    migrationName: 'm',
                    confirmed: extra.confirmed ?? []
                },
                'actor'
            );
        return { lock, log, job, apply };
    }

    it('accepts, records the operation as running, hands it to the job holding the lock', async () => {
        const { lock, log, job, apply } = setup();
        const accepted = await apply(
            documentOf(withField(tag, 'color', { type: 'text' }))
        );
        expect(accepted).toEqual({
            operationId: expect.any(String),
            bootId: 'boot-1'
        });
        expect(log.history[0]).toMatchObject({
            id: accepted.operationId,
            status: 'running',
            step: 'generate',
            bootId: 'boot-1'
        });
        expect(job.run).toHaveBeenCalledWith(
            expect.objectContaining({ migrationName: 'm', actorId: 'actor' })
        );
        expect(lock.held).toBe(1);
    });

    it('refuses a second apply while one holds the lock [schema-builder:I-05]', async () => {
        const { apply } = setup();
        await apply(documentOf(withField(tag, 'color', { type: 'text' })));
        await expect(
            apply(documentOf(withField(tag, 'other', { type: 'text' })))
        ).rejects.toBeInstanceOf(ApplyInProgressError);
    });

    it.each([
        [
            'stale',
            StaleDocumentError,
            { baseFingerprint: 'ffffffffffffffff' },
            null
        ],
        ['blocked', SchemaBlockedError, {}, { tag: 2 }],
        ['unconfirmed', UnconfirmedChangesError, {}, null]
    ] as const)(
        'refuses a %s draft and gives the lock back',
        async (_, kind, extra, rows) => {
            const { lock, job, apply } = setup(rows ?? {});
            const draft =
                kind === SchemaBlockedError
                    ? documentOf(
                          withField(tag, 'code', {
                              type: 'text',
                              required: true
                          })
                      )
                    : kind === UnconfirmedChangesError
                      ? documentOf({ ...tag, fields: [tag.fields[0]] })
                      : documentOf(tag);
            await expect(apply(draft, extra)).rejects.toBeInstanceOf(kind);
            expect(job.run).not.toHaveBeenCalled();
            expect(lock.held).toBe(0);
        }
    );

    it('applies a destructive change once it is confirmed by id', async () => {
        const { job, apply } = setup();
        await apply(documentOf({ ...tag, fields: [tag.fields[0]] }), {
            confirmed: ['field.remove:tag.legacy']
        });
        expect(job.run).toHaveBeenCalled();
    });
});
