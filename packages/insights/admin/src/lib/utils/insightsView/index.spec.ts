import { describe, expect, it } from 'vitest';
import {
    insightsTabParam,
    resolveInsightsSignal,
    resolveInsightsTab
} from '.';

const TABS = ['overview', 'content', 'reach', 'team'];

describe('insightsView', () => {
    it('opens the tab a link names, and the first one otherwise', () => {
        expect(resolveInsightsTab('reach', TABS)).toBe('reach');
        expect(resolveInsightsTab(null, TABS)).toBe('overview');
        // A tab this reader has no widgets in is not a tab they can see.
        expect(resolveInsightsTab('nonsense', TABS)).toBe('overview');
        expect(resolveInsightsTab('team', ['overview'])).toBe('overview');
        expect(resolveInsightsTab('x', [])).toBeUndefined();
    });

    it('leaves the first tab out of the URL', () => {
        expect(insightsTabParam('overview', TABS)).toBeUndefined();
        expect(insightsTabParam('team', TABS)).toBe('team');
    });

    it('opens only a drill-down the reader can see', () => {
        expect(resolveInsightsSignal('a', ['a', 'b'])).toBe('a');
        expect(resolveInsightsSignal('c', ['a', 'b'])).toBeNull();
        expect(resolveInsightsSignal(null, ['a'])).toBeNull();
    });
});
