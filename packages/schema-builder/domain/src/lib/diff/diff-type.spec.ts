import { fieldOf, typeOf } from '../../testing/fixtures';
import { diffFieldOrder } from './diff-field-order';
import { diffFields } from './diff-fields';
import { diffType } from './diff-type';
import { diffTypeFlags } from './diff-type-flags';
import { diffTypeMeta } from './diff-type-meta';

const event = typeOf('event', {
    title: { type: 'text' },
    startsAt: { type: 'datetime' },
    endsAt: { type: 'datetime' }
});

describe('diffTypeMeta', () => {
    it('reports labels, path and groups together', () => {
        const after = {
            ...event,
            label: 'Events',
            groups: [{ key: 'when', label: 'When' }]
        };
        expect(diffTypeMeta(event, after)).toEqual([
            { kind: 'type.meta', type: 'event', keys: ['label', 'groups'] }
        ]);
    });
});

describe('diffTypeFlags', () => {
    it('reports one change per flipped flag, with its new value', () => {
        expect(
            diffTypeFlags(event, { ...event, publishable: true, i18n: true })
        ).toEqual([
            { kind: 'type.flag', type: 'event', flag: 'publishable', to: true },
            { kind: 'type.flag', type: 'event', flag: 'i18n', to: true }
        ]);
    });
});

describe('diffFields', () => {
    it('lists removed, then changed, then added fields', () => {
        const after = {
            ...event,
            fields: [
                {
                    ...event.fields[0],
                    spec: { type: 'text' as const, maxLength: 10 }
                },
                event.fields[1],
                fieldOf('event', 'venue', { type: 'text' })
            ]
        };
        expect(diffFields(event, after).map((change) => change.kind)).toEqual([
            'field.remove',
            'field.update',
            'field.add'
        ]);
    });
});

describe('diffFieldOrder', () => {
    it('reports a reorder of the fields both sides share', () => {
        const after = {
            ...event,
            fields: [event.fields[1], event.fields[0], event.fields[2]]
        };
        expect(diffFieldOrder(event, after)).toEqual([
            { kind: 'field.reorder', type: 'event' }
        ]);
    });

    it('does not read an addition or a removal as a reorder', () => {
        const after = {
            ...event,
            fields: [
                event.fields[0],
                fieldOf('event', 'venue', { type: 'text' }),
                event.fields[2]
            ]
        };
        expect(diffFieldOrder(event, after)).toEqual([]);
    });
});

describe('diffType', () => {
    it('is empty for an identical type', () => {
        expect(diffType(event, structuredClone(event))).toEqual([]);
    });
});
