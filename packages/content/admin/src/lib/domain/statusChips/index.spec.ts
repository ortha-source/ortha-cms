import { arrangeStatusChips, sortStatusItems } from './index';

const item = (id: string, severity: 'blocking' | 'warning' | 'info') => ({
    id,
    severity
});

describe('sortStatusItems', () => {
    it('orders blocking → warning → info, keeping order within a severity', () => {
        expect(
            sortStatusItems([
                item('i', 'info'),
                item('w1', 'warning'),
                item('b', 'blocking'),
                item('w2', 'warning')
            ]).map((x) => x.id)
        ).toEqual(['b', 'w1', 'w2', 'i']);
    });
});

describe('arrangeStatusChips', () => {
    it('shows up to two chips, most severe first', () => {
        const { chips, more } = arrangeStatusChips([
            item('w', 'warning'),
            item('b', 'blocking')
        ]);
        expect(chips.map((x) => x.id)).toEqual(['b', 'w']);
        expect(more).toBe(0);
    });

    it('folds everything but the top chip behind +N from the third item on', () => {
        const { chips, more } = arrangeStatusChips([
            item('w', 'warning'),
            item('b', 'blocking'),
            item('i', 'info')
        ]);
        expect(chips.map((x) => x.id)).toEqual(['b']);
        expect(more).toBe(2);
    });

    it('never gives an info item a chip while something blocks', () => {
        const { chips, more } = arrangeStatusChips([
            item('i', 'info'),
            item('b', 'blocking')
        ]);
        expect(chips.map((x) => x.id)).toEqual(['b']);
        expect(more).toBe(1);
    });

    it('lets info take chips when nothing blocks', () => {
        expect(
            arrangeStatusChips([item('i', 'info')]).chips.map((x) => x.id)
        ).toEqual(['i']);
    });

    it('draws nothing for nothing', () => {
        expect(arrangeStatusChips([])).toEqual({ chips: [], more: 0 });
    });
});
