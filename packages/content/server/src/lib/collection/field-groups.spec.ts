import { collection, single } from './define';
import { field } from '../fields';
import { ContentTypeRegistry } from '../registry/content-type-registry';

describe('form groups on collection() / single()', () => {
    it('normalizes groups in declaration order, collapsed off by default', () => {
        const type = collection('event', {
            groups: {
                schedule: { label: 'Schedule', collapsed: true },
                advanced: { label: 'Advanced', description: 'Raw data' }
            },
            fields: {
                title: field.text(),
                startsAt: field.datetime({ admin: { group: 'schedule' } }),
                metadata: field.json({ admin: { group: 'advanced' } })
            }
        });

        expect(type.groups).toEqual([
            { key: 'schedule', label: 'Schedule', collapsed: true },
            {
                key: 'advanced',
                label: 'Advanced',
                description: 'Raw data',
                collapsed: false
            }
        ]);
    });

    it('rejects a field naming a group the type does not declare', () => {
        expect(() =>
            collection('event', {
                groups: { schedule: { label: 'Schedule' } },
                fields: {
                    startsAt: field.datetime({ admin: { group: 'schedule' } }),
                    endsAt: field.datetime({ admin: { group: 'shedule' } })
                }
            })
        ).toThrow(/"event.endsAt" names group "shedule"/);
    });

    it('rejects a group no field joins', () => {
        expect(() =>
            single('home', {
                path: '/',
                groups: { seo: { label: 'SEO' } },
                fields: { title: field.text() }
            })
        ).toThrow(/"home.seo" has no fields/);
    });

    it('rejects a group without a label', () => {
        expect(() =>
            collection('event', {
                groups: { schedule: { label: ' ' } },
                fields: {
                    startsAt: field.datetime({ admin: { group: 'schedule' } })
                }
            })
        ).toThrow(/needs a label/);
    });

    it('serves groups with the schema, and omits the key when there are none', () => {
        const grouped = collection('event', {
            groups: { schedule: { label: 'Schedule' } },
            fields: {
                startsAt: field.datetime({ admin: { group: 'schedule' } })
            }
        });
        const plain = collection('note', { fields: { body: field.text() } });
        const registry = new ContentTypeRegistry([grouped, plain]);

        expect(registry.serialize('event')?.groups).toEqual([
            { key: 'schedule', label: 'Schedule', collapsed: false }
        ]);
        expect(registry.serialize('note')).not.toHaveProperty('groups');
    });
});
