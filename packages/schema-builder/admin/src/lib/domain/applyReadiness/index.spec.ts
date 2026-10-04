import type {
    ClassifiedChange,
    SchemaPlan
} from '@orthacms/schema-builder-domain';
import { applyReadiness, createdTypes } from './index';

const change = (
    id: string,
    safety: ClassifiedChange['safety'],
    kind: 'type.add' | 'field.remove' = 'field.remove'
): ClassifiedChange => ({
    id,
    safety,
    reason: 'drops-data',
    storage: true,
    change:
        kind === 'type.add'
            ? { kind, type: 'event' }
            : { kind, type: 'event', field: 'x', spec: { type: 'text' } }
});
const planOf = (changes: ClassifiedChange[], blocked = false): SchemaPlan => ({
    baseFingerprint: 'f',
    changes,
    blocked,
    files: [],
    sql: []
});

describe('applyReadiness', () => {
    it('is ready when nothing is blocked, every deletion is confirmed and the name is valid', () => {
        expect(
            applyReadiness(
                planOf([change('a', 'safe'), change('b', 'destructive')]),
                new Set(['b']),
                'drop_x'
            )
        ).toEqual({ ok: true });
    });

    it('lists exactly the deletions still unconfirmed', () => {
        expect(
            applyReadiness(
                planOf([
                    change('a', 'destructive'),
                    change('b', 'destructive')
                ]),
                new Set(['a']),
                'm'
            )
        ).toEqual({
            ok: false,
            reason: 'unconfirmed',
            missing: ['b']
        });
    });

    it('refuses a blocked plan, an empty one, and a name the server would refuse', () => {
        expect(
            applyReadiness(
                planOf([change('a', 'blocked')], true),
                new Set(),
                'm'
            )
        ).toMatchObject({ reason: 'blocked' });
        expect(applyReadiness(planOf([]), new Set(), 'm')).toMatchObject({
            reason: 'nothing'
        });
        expect(
            applyReadiness(planOf([change('a', 'safe')]), new Set(), 'Bad Name')
        ).toMatchObject({ reason: 'name' });
    });
});

describe('createdTypes', () => {
    it('names the types the plan adds', () => {
        expect(
            createdTypes(
                planOf([change('t', 'safe', 'type.add'), change('f', 'safe')])
            )
        ).toEqual(['event']);
    });
});
