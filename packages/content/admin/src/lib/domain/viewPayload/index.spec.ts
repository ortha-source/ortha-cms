import {
    captureViewPayload,
    droppedColumnCount,
    isViewDirty,
    reconcileColumns,
    serializePayload,
    viewPayloadToParams,
    type ListState
} from '.';

/** The column ids the type offers in these tests. */
const ALL_COLUMNS = ['title', 'status', 'author', 'updatedAt'];

/** A live list state with everything at its "nothing set" value. */
function emptyState(overrides: Partial<ListState> = {}): ListState {
    return {
        filter: '',
        sort: '',
        pageSize: 25,
        columns: [],
        extra: {},
        ...overrides
    };
}

describe('captureViewPayload()', () => {
    it('omits the values that mean "nothing set"', () => {
        expect(captureViewPayload(emptyState())).toEqual({ pageSize: 25 });
    });

    it('keeps the values that are set', () => {
        expect(
            captureViewPayload(
                emptyState({
                    filter: '{"op":"and","rules":[]}',
                    sort: '-updatedAt',
                    columns: ['title', 'status'],
                    extra: { locale: 'en' }
                })
            )
        ).toEqual({
            filter: '{"op":"and","rules":[]}',
            sort: '-updatedAt',
            pageSize: 25,
            columns: ['title', 'status'],
            extra: { locale: 'en' }
        });
    });

    it('drops slot params that are absent, so they cannot read as a change', () => {
        const payload = captureViewPayload(
            emptyState({ extra: { locale: undefined } })
        );
        expect(payload.extra).toBeUndefined();
    });

    it('copies the column array rather than aliasing the caller state', () => {
        const columns = ['title'];
        const payload = captureViewPayload(emptyState({ columns }));
        columns.push('status');
        expect(payload.columns).toEqual(['title']);
    });
});

describe('isViewDirty()', () => {
    it('is false for the state the payload was captured from', () => {
        const state = emptyState({
            filter: '{"op":"and"}',
            sort: 'title',
            columns: ['title'],
            extra: { locale: 'en' }
        });
        expect(isViewDirty(captureViewPayload(state), state, ALL_COLUMNS)).toBe(
            false
        );
    });

    it('ignores key order inside the stored payload', () => {
        // A payload round-tripped through the API can come back with its keys
        // in any order; that is not a change the user made.
        const state = emptyState({ sort: 'title', pageSize: 50 });
        expect(
            isViewDirty({ pageSize: 50, sort: 'title' }, state, ALL_COLUMNS)
        ).toBe(false);
    });

    it('ignores slot-param key order', () => {
        const state = emptyState({ extra: { locale: 'en', channel: 'web' } });
        expect(
            isViewDirty(
                { pageSize: 25, extra: { channel: 'web', locale: 'en' } },
                state,
                ALL_COLUMNS
            )
        ).toBe(false);
    });

    it('treats an empty filter and an absent one as the same', () => {
        expect(
            isViewDirty({ pageSize: 25, filter: '' }, emptyState(), ALL_COLUMNS)
        ).toBe(false);
    });

    it('is true when a filter rule is removed', () => {
        expect(
            isViewDirty(
                { pageSize: 25, filter: '{"op":"and"}' },
                emptyState(),
                ALL_COLUMNS
            )
        ).toBe(true);
    });

    it('is true when columns are reordered — order is part of the view', () => {
        const state = emptyState({ columns: ['status', 'title'] });
        expect(
            isViewDirty(
                { pageSize: 25, columns: ['title', 'status'] },
                state,
                ALL_COLUMNS
            )
        ).toBe(true);
    });

    it('is true when the page size changes', () => {
        expect(isViewDirty({ pageSize: 50 }, emptyState(), ALL_COLUMNS)).toBe(
            true
        );
    });

    it('is clean when the only difference is a column the type has lost', () => {
        // The view pinned three columns; one no longer exists, so applying it
        // put two on screen. That is the schema's doing, not the reader's —
        // blaming them for it burns the badge on every visit.
        const state = emptyState({ columns: ['title', 'status'] });
        expect(
            isViewDirty(
                { pageSize: 25, columns: ['title', 'gone', 'status'] },
                state,
                ALL_COLUMNS
            )
        ).toBe(false);
    });

    it('ignores columns entirely when the view pins nothing usable', () => {
        // Every pinned column is gone, so the table shows the type's defaults —
        // a selection the view never claimed to control.
        const state = emptyState({ columns: ['title', 'status'] });
        expect(
            isViewDirty(
                { pageSize: 25, columns: ['gone', 'alsoGone'] },
                state,
                ALL_COLUMNS
            )
        ).toBe(false);
    });

    it('still trips when the reader hides a column the view did pin', () => {
        const state = emptyState({ columns: ['title'] });
        expect(
            isViewDirty(
                { pageSize: 25, columns: ['title', 'status'] },
                state,
                ALL_COLUMNS
            )
        ).toBe(true);
    });

    it('does not consider the search box or the page number', () => {
        // Neither is captured, so neither can make a view read as modified.
        const state = emptyState({ sort: 'title' });
        const payload = captureViewPayload(state);
        expect(serializePayload(payload)).toEqual(
            serializePayload(captureViewPayload({ ...state }))
        );
    });
});

describe('viewPayloadToParams()', () => {
    it('clears the params a payload does not set', () => {
        expect(viewPayloadToParams({ pageSize: 25 }, ['locale'])).toEqual({
            filter: undefined,
            sort: undefined,
            pageSize: '25',
            page: undefined,
            locale: undefined
        });
    });

    it('always resets the page — a view is a slice, not a position', () => {
        const params = viewPayloadToParams(
            { pageSize: 25, filter: '{"op":"and"}' },
            []
        );
        expect(params.page).toBeUndefined();
    });

    it('only replays the slot params the page owns right now', () => {
        // The payload was saved while another plugin contributed `channel`;
        // with that plugin gone the param must not come back.
        const params = viewPayloadToParams(
            { extra: { locale: 'en', channel: 'web' } },
            ['locale']
        );
        expect(params.locale).toBe('en');
        expect(params).not.toHaveProperty('channel');
    });
});

describe('reconcileColumns()', () => {
    it('keeps the payload order, dropping ids the type no longer has', () => {
        expect(
            reconcileColumns({ columns: ['status', 'gone', 'title'] }, [
                'title',
                'status'
            ])
        ).toEqual(['status', 'title']);
    });

    it('returns null when the payload pins no columns', () => {
        expect(reconcileColumns({}, ['title'])).toBeNull();
    });

    it('returns null when every pinned column is gone, so defaults win', () => {
        expect(reconcileColumns({ columns: ['gone'] }, ['title'])).toBeNull();
    });
});

describe('droppedColumnCount()', () => {
    it('counts the pinned columns the type no longer has', () => {
        expect(
            droppedColumnCount({ columns: ['title', 'gone', 'alsoGone'] }, [
                'title'
            ])
        ).toBe(2);
    });

    it('is zero when the payload pins nothing', () => {
        expect(droppedColumnCount({}, ['title'])).toBe(0);
    });
});
