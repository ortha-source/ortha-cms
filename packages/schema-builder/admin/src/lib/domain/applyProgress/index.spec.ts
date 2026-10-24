import {
    advance,
    failProgress,
    startProgress,
    stepDuration,
    stepState
} from './index';

describe('applyProgress', () => {
    it('times each step it saw from start to end', () => {
        let progress = startProgress(0);
        progress = advance(progress, 'migrate', 800);
        progress = advance(progress, 'publish', 2000);
        progress = advance(progress, 'restart', 2100);
        progress = advance(progress, 'ready', 6100);
        expect(stepDuration(progress, 'generate')).toBe(800);
        expect(stepDuration(progress, 'migrate')).toBe(1200);
        expect(stepDuration(progress, 'publish')).toBe(100);
        expect(stepDuration(progress, 'restart')).toBe(4000);
        expect(stepState(progress, 'ready')).toBe('done');
        expect(stepState(progress, 'restart')).toBe('done');
    });

    it('marks a step that ran between two polls done, with no time', () => {
        const progress = advance(startProgress(0), 'publish', 900);
        expect(stepState(progress, 'migrate')).toBe('done');
        expect(stepDuration(progress, 'migrate')).toBeUndefined();
        expect(stepState(progress, 'publish')).toBe('current');
        expect(stepState(progress, 'restart')).toBe('pending');
    });

    it('never moves backwards on a repeated or stale poll', () => {
        const progress = advance(startProgress(0), 'migrate', 500);
        expect(advance(progress, 'migrate', 900)).toBe(progress);
        expect(advance(progress, 'generate', 900)).toBe(progress);
    });

    it('stops at the step the server says failed', () => {
        const progress = failProgress(startProgress(0), 'migrate', 700);
        expect(stepState(progress, 'generate')).toBe('done');
        expect(stepState(progress, 'migrate')).toBe('failed');
        expect(stepState(progress, 'publish')).toBe('pending');
    });
});
