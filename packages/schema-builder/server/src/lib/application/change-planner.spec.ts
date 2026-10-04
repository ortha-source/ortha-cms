import {
    documentOf,
    envelopeOf,
    typeOf,
    withField
} from '../../testing/documents';
import { statsOf } from '../../testing/fakes';
import {
    NotBuilderOwnedError,
    SchemaInvalidError,
    StaleDocumentError
} from '../domain/errors';
import { ChangePlanner } from './change-planner';

describe('ChangePlanner', () => {
    const tag = typeOf(
        'tag',
        { name: { type: 'text' }, legacy: { type: 'text' } },
        { publishable: false }
    );
    const current = envelopeOf(documentOf(tag));
    const planner = new ChangePlanner(statsOf({ tag: 5 }));

    it('classifies each change against the database facts', async () => {
        const draft = documentOf(withField(tag, 'color', { type: 'text' }));
        const plan = await planner.plan(current, draft, current.fingerprint);
        expect(
            plan.changes.map((change) => [change.id, change.safety])
        ).toEqual([['field.add:tag.color', 'safe']]);
        expect(plan).toMatchObject({ blocked: false, needsMigration: true });
    });

    it('reports a code-only change as needing no migration', async () => {
        const draft = documentOf({ ...tag, label: 'Tags' });
        expect(
            await planner.plan(current, draft, current.fingerprint)
        ).toMatchObject({ needsMigration: false });
    });

    it('marks the plan blocked when a verdict blocks — a required field on a live type with rows', async () => {
        const draft = documentOf(
            withField(tag, 'code', { type: 'text', required: true })
        );
        const plan = await planner.plan(current, draft, current.fingerprint);
        expect(plan.blocked).toBe(true);
    });

    it('checks freshness, then validity, then ownership — in that order', async () => {
        const invalid = documentOf(withField(tag, 'id', { type: 'text' }));
        await expect(
            planner.plan(current, invalid, 'ffffffffffffffff')
        ).rejects.toBeInstanceOf(StaleDocumentError);
        await expect(
            planner.plan(current, invalid, current.fingerprint)
        ).rejects.toBeInstanceOf(SchemaInvalidError);

        const hand = envelopeOf(documentOf({ ...tag, origin: 'code' }));
        const touched = documentOf(
            withField({ ...tag, origin: 'code' }, 'color', { type: 'text' })
        );
        await expect(
            planner.plan(hand, touched, hand.fingerprint)
        ).rejects.toBeInstanceOf(NotBuilderOwnedError);
    });
});
