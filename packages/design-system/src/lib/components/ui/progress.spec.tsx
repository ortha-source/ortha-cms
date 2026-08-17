import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from './progress';

/** QA ORT-49 · F49 step 4, EC-04, EC-07 — the indicator had no clamp. */
describe('Progress', () => {
    const indicator = () =>
        screen.getByRole('progressbar').firstElementChild as HTMLElement;

    it('translates the indicator by the remaining percentage', () => {
        render(<Progress value={40} aria-label="Upload" />);
        expect(indicator().style.transform).toBe('translateX(-60%)');
    });

    // EC-04.
    it('renders an empty bar for an indeterminate value', () => {
        render(<Progress aria-label="Upload" />);
        expect(indicator().style.transform).toBe('translateX(-100%)');
    });

    // EC-07 — an unclamped value drew the fill outside its own track.
    it('clamps a value above 100', () => {
        render(<Progress value={150} aria-label="Upload" />);
        expect(indicator().style.transform).toBe('translateX(-0%)');
    });

    it('clamps a negative value', () => {
        render(<Progress value={-5} aria-label="Upload" />);
        expect(indicator().style.transform).toBe('translateX(-100%)');
    });
});
