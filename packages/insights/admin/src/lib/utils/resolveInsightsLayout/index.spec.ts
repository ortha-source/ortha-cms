import type { ComponentType } from 'react';
import {
    resolveInsightsLayout,
    type ResolveInsightsLayoutInput
} from './index';
import type {
    InsightsSection,
    InsightsWidget
} from '../../presentation/slots/insightsSlots';

/**
 * Widgets are only ever identified and grouped here — never rendered — so a
 * stand-in component keeps these cases about the layout rules.
 */
const Noop = (() => null) as ComponentType;

const widget = (
    over: Partial<InsightsWidget> & { id: string }
): InsightsWidget => ({
    section: 'content',
    titleId: `${over.id}.title`,
    defaultTitle: over.id,
    Component: Noop,
    ...over
});

const section = (
    over: Partial<InsightsSection> & { id: string }
): InsightsSection => ({
    titleId: `${over.id}.title`,
    defaultTitle: over.id,
    ...over
});

const FALLBACK = {
    id: 'other',
    titleId: 'insights.section.other',
    defaultTitle: 'More'
};

const resolve = (over: Partial<ResolveInsightsLayoutInput>) =>
    resolveInsightsLayout({
        sections: [],
        widgets: [],
        permissions: [],
        fallback: FALLBACK,
        ...over
    });

describe('resolveInsightsLayout', () => {
    describe('grouping and ordering', () => {
        it('groups widgets under their section, sections in order', () => {
            const bands = resolve({
                sections: [
                    section({ id: 'team', order: 20 }),
                    section({ id: 'content', order: 10 })
                ],
                widgets: [
                    widget({ id: 'w-team', section: 'team' }),
                    widget({ id: 'w-content', section: 'content' })
                ]
            });

            expect(bands.map((band) => band.section.id)).toEqual([
                'content',
                'team'
            ]);
            expect(bands[0].widgets.map((w) => w.id)).toEqual(['w-content']);
        });

        it('orders widgets within a section', () => {
            const [band] = resolve({
                sections: [section({ id: 'content' })],
                widgets: [
                    widget({ id: 'second', order: 20 }),
                    widget({ id: 'first', order: 10 })
                ]
            });

            expect(band.widgets.map((w) => w.id)).toEqual(['first', 'second']);
        });

        it('keeps registration order for items sharing an order [insights:I-06]', () => {
            // Two plugins with no opinion must still produce a deterministic
            // page rather than one that depends on iteration order.
            const [band] = resolve({
                sections: [section({ id: 'content' })],
                widgets: [widget({ id: 'alpha' }), widget({ id: 'beta' })]
            });

            expect(band.widgets.map((w) => w.id)).toEqual(['alpha', 'beta']);
        });

        it('sorts an order-less section after the built-ins [insights:I-07]', () => {
            const bands = resolve({
                sections: [
                    section({ id: 'late' }),
                    section({ id: 'early', order: 10 })
                ],
                widgets: [
                    widget({ id: 'a', section: 'late' }),
                    widget({ id: 'b', section: 'early' })
                ]
            });

            expect(bands.map((band) => band.section.id)).toEqual([
                'early',
                'late'
            ]);
        });
    });

    describe('section contributions', () => {
        it('lets a plugin open a brand-new band', () => {
            const bands = resolve({
                sections: [
                    section({ id: 'content', order: 10 }),
                    section({
                        id: 'seo',
                        order: 25,
                        defaultTitle: 'Search',
                        defaultDescription: 'How the site is found.'
                    })
                ],
                widgets: [
                    widget({ id: 'w1', section: 'content' }),
                    widget({ id: 'w2', section: 'seo' })
                ]
            });

            expect(bands.map((b) => b.section.id)).toEqual(['content', 'seo']);
            expect(bands[1].section.defaultTitle).toBe('Search');
            expect(bands[1].section.defaultDescription).toBe(
                'How the site is found.'
            );
        });

        it('a later contribution overrides an earlier one by id', () => {
            const [band] = resolve({
                sections: [
                    section({ id: 'team', order: 40, defaultTitle: 'Team' }),
                    section({ id: 'team', defaultTitle: 'People' })
                ],
                widgets: [widget({ id: 'w', section: 'team' })]
            });

            expect(band.section.defaultTitle).toBe('People');
        });

        it('an override only replaces the fields it sets [insights:I-05]', () => {
            // Renaming a band must not silently reset its order to the default
            // and move it to the bottom of the page.
            const [band] = resolve({
                sections: [
                    section({
                        id: 'team',
                        order: 40,
                        defaultDescription: 'Who did what.'
                    }),
                    section({ id: 'team', defaultTitle: 'People' })
                ],
                widgets: [widget({ id: 'w', section: 'team' })]
            });

            expect(band.section.defaultTitle).toBe('People');
            expect(band.section.order).toBe(40);
            expect(band.section.defaultDescription).toBe('Who did what.');
        });

        it('an override does not move the band [insights:I-05]', () => {
            const bands = resolve({
                sections: [
                    section({ id: 'content', order: 10 }),
                    section({ id: 'team', order: 20 }),
                    section({ id: 'content', defaultTitle: 'Articles' })
                ],
                widgets: [
                    widget({ id: 'a', section: 'content' }),
                    widget({ id: 'b', section: 'team' })
                ]
            });

            expect(bands.map((b) => b.section.id)).toEqual(['content', 'team']);
        });
    });

    describe('permissions', () => {
        it('drops widgets the user lacks the permission for [insights:I-08]', () => {
            const [band] = resolve({
                sections: [section({ id: 'content' })],
                widgets: [
                    widget({ id: 'open' }),
                    widget({ id: 'gated', permission: 'content:read' })
                ],
                permissions: []
            });

            expect(band.widgets.map((w) => w.id)).toEqual(['open']);
        });

        it('keeps a gated widget when the permission is held', () => {
            const [band] = resolve({
                sections: [section({ id: 'content' })],
                widgets: [widget({ id: 'gated', permission: 'content:read' })],
                permissions: ['content:read']
            });

            expect(band.widgets).toHaveLength(1);
        });

        it('drops a band whose every widget is gated out [insights:I-04]', () => {
            // Otherwise a reader gets a "Content" heading over nothing.
            const bands = resolve({
                sections: [
                    section({ id: 'content', order: 10 }),
                    section({ id: 'team', order: 20 })
                ],
                widgets: [
                    widget({
                        id: 'gated',
                        section: 'content',
                        permission: 'content:read'
                    }),
                    widget({ id: 'open', section: 'team' })
                ],
                permissions: []
            });

            expect(bands.map((b) => b.section.id)).toEqual(['team']);
        });
    });

    describe('sections nobody registered', () => {
        it('keeps the widget in a trailing catch-all band [insights:I-03]', () => {
            // A missing card with no error anywhere is the worst failure a
            // plugin system can have — losing it is not an option.
            const bands = resolve({
                sections: [section({ id: 'content', order: 10 })],
                widgets: [
                    widget({ id: 'known', section: 'content' }),
                    widget({ id: 'orphan', section: 'nowhere' })
                ]
            });

            expect(bands).toHaveLength(2);
            expect(bands[1].isFallback).toBe(true);
            expect(bands[1].section.defaultTitle).toBe('More');
            expect(bands[1].widgets.map((w) => w.id)).toEqual(['orphan']);
        });

        it('does not add the catch-all when every section is registered', () => {
            const bands = resolve({
                sections: [section({ id: 'content' })],
                widgets: [widget({ id: 'known', section: 'content' })]
            });

            expect(bands).toHaveLength(1);
            expect(bands[0].isFallback).toBeUndefined();
        });

        it('still applies permissions to orphaned widgets [insights:I-08]', () => {
            const bands = resolve({
                sections: [],
                widgets: [
                    widget({
                        id: 'orphan',
                        section: 'nowhere',
                        permission: 'content:read'
                    })
                ],
                permissions: []
            });

            expect(bands).toEqual([]);
        });

        it('collects orphans from several unknown sections into one band', () => {
            const bands = resolve({
                widgets: [
                    widget({ id: 'a', section: 'ghost-one' }),
                    widget({ id: 'b', section: 'ghost-two' })
                ]
            });

            expect(bands).toHaveLength(1);
            expect(bands[0].widgets.map((w) => w.id)).toEqual(['a', 'b']);
        });
    });

    it('returns nothing when there is nothing to show', () => {
        expect(resolve({})).toEqual([]);
    });

    it('drops a registered section that has no widgets', () => {
        expect(resolve({ sections: [section({ id: 'empty' })] })).toEqual([]);
    });
});
