import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WizardProgress } from './index';

const steps = [{ label: 'Basics' }, { label: 'Content' }, { label: 'People' }];

function renderAt(current: number, maxReached: number) {
    const onStepClick = vi.fn();
    render(
        <WizardProgress
            steps={steps}
            current={current}
            maxReached={maxReached}
            onStepClick={onStepClick}
            label="Progress"
            stepLabel={(step, n, state) =>
                `Step ${n}: ${step.label} (${state})`
            }
        />
    );
    return onStepClick;
}

describe('WizardProgress', () => {
    it('marks the current step and makes a finished one a way back', () => {
        const onStepClick = renderAt(2, 2);

        const list = screen.getByRole('list', { name: 'Progress' });
        expect(
            list.querySelector('[aria-current="step"]')?.textContent
        ).toContain('Step 2: Content (current)');

        fireEvent.click(
            screen.getByRole('button', { name: 'Step 1: Basics (complete)' })
        );
        expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('offers no button for a step not reached yet, nor the current one', () => {
        renderAt(1, 1);
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('lets a reached later step be revisited after going back', () => {
        const onStepClick = renderAt(1, 3);
        fireEvent.click(
            screen.getByRole('button', { name: 'Step 3: People (upcoming)' })
        );
        expect(onStepClick).toHaveBeenCalledWith(3);
    });
});
