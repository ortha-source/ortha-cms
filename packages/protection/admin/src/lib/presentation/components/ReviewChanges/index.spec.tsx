import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewChanges } from './index';

type Query = { data?: unknown; isPending: boolean; isError: boolean };

let schema: Query;
let revisions: Record<number, Query>;
const asked: (number | undefined)[] = [];

// The reads are content's; the comparison and the value rendering are content's
// real exports, which is the point — the panel draws what History would.
vi.mock('@orthacms/content-admin', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@orthacms/content-admin')>()),
    useContentSchema: () => schema,
    useRevisionDetail: (_type: string, id?: string, number?: number) => {
        if (id) asked.push(number);
        return id && number != null
            ? revisions[number]
            : { isPending: false, isError: false };
    }
}));

const SCHEMA = {
    name: 'article',
    kind: 'collection',
    label: 'Articles',
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            admin: { label: 'Title' }
        },
        {
            name: 'price',
            type: 'number',
            required: false,
            admin: { label: 'Price (Pro)' }
        },
        {
            name: 'slug',
            type: 'text',
            required: false,
            admin: { label: 'Slug' }
        }
    ]
};

const version = (values: Record<string, unknown>): Query => ({
    isPending: false,
    isError: false,
    data: { snapshot: { values, relations: {} } }
});

const show = (headNumber: number | null, liveNumber: number | null) =>
    render(
        <IntlProvider locale="en">
            <ReviewChanges
                typeName="article"
                entryId="e1"
                headNumber={headNumber}
                liveNumber={liveNumber}
            />
        </IntlProvider>
    );

beforeEach(() => {
    asked.length = 0;
    schema = { isPending: false, isError: false, data: SCHEMA };
    revisions = {
        3: version({ title: 'Pricing questions', price: 29, slug: 'faq' }),
        5: version({ title: 'Pricing FAQ', price: 35, slug: 'faq' })
    };
});

describe('ReviewChanges', () => {
    it('lists only the changed fields, live struck out beside this version', () => {
        show(5, 3);

        const table = screen.getByRole('table', {
            name: 'Changes since it was last published'
        });
        expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
        expect(screen.getByRole('rowheader', { name: 'Title' })).toBeTruthy();
        expect(
            screen.getByText('Pricing questions').closest('del')
        ).toBeTruthy();
        expect(screen.getByText('Pricing FAQ').closest('ins')).toBeTruthy();
        // Unchanged: not drawn.
        expect(screen.queryByRole('rowheader', { name: 'Slug' })).toBeNull();
    });

    it('compares a never-published record against nothing', () => {
        show(5, null);

        expect(screen.getAllByText('Not published')).toHaveLength(3);
        expect(asked).toEqual([5]);
    });

    it('reads nothing when this version is the live one', () => {
        show(4, 4);

        expect(
            screen.getByText('Nothing has changed since it was published.')
        ).toBeTruthy();
        expect(asked).toEqual([]);
    });

    it('says the changes could not be loaded rather than that there are none', () => {
        revisions[3] = { isPending: false, isError: true };
        show(5, 3);

        expect(screen.getByRole('alert').textContent).toMatch(
            /could not be loaded/
        );
        expect(screen.queryByText(/Nothing has changed/)).toBeNull();
    });

    it('says it is loading while a version is in flight', () => {
        revisions[5] = { isPending: true, isError: false };
        show(5, 3);

        expect(screen.getByRole('status').textContent).toMatch(/Loading/);
    });
});
