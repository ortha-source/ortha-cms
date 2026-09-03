import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Stepper, type StepperStep } from './wizard';

/**
 * QA ORT-49 · F46, EC-05, EC-08, EC-09 — `🐞 BUG-design-system-09`.
 *
 * The rail is keyed by `step.label`, which is consumer copy, not an identity.
 * The only wizard shipped today happens to have distinct labels, so no page
 * test can reach the collision; it is pinned at the primitive instead.
 */
const steps: StepperStep[] = [
    { label: 'Basics', hint: 'Name it' },
    { label: 'Members', hint: 'Invite people', optional: true },
    { label: 'Review', hint: 'Check it over' }
];

const label = (step: StepperStep, n: number) => `Step ${n}: ${step.label}`;

function renderStepper(props: Partial<Parameters<typeof Stepper>[0]> = {}) {
    return render(
        <Stepper
            current={1}
            maxReached={1}
            steps={steps}
            onStepClick={() => undefined}
            stepAriaLabel={label}
            {...props}
        />
    );
}

describe('Stepper', () => {
    it('marks only the active step as the current step', () => {
        renderStepper({ current: 2, maxReached: 2 });

        expect(
            screen
                .getAllByRole('button')
                .filter((b) => b.getAttribute('aria-current') === 'step')
                .map((b) => b.getAttribute('aria-label'))
        ).toEqual(['Step 2: Members']);
    });

    it('disables the steps that have not been reached', () => {
        renderStepper({ current: 1, maxReached: 1 });

        const disabled = screen
            .getAllByRole('button')
            .filter((b) => (b as HTMLButtonElement).disabled)
            .map((b) => b.getAttribute('aria-label'));
        expect(disabled).toEqual(['Step 2: Members', 'Step 3: Review']);
    });

    it('jumps back to a reached step', () => {
        const onStepClick = vi.fn();
        renderStepper({ current: 2, maxReached: 2, onStepClick });

        screen.getByRole('button', { name: 'Step 1: Basics' }).click();
        expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('hides the optional badge when no optionalLabel is supplied', () => {
        const { rerender } = renderStepper();
        expect(screen.queryByText('Optional')).toBeNull();

        rerender(
            <Stepper
                current={1}
                maxReached={1}
                steps={steps}
                onStepClick={() => undefined}
                stepAriaLabel={label}
                optionalLabel="Optional"
            />
        );
        expect(screen.getByText('Optional')).toBeTruthy();
    });

    // EC-05.
    it('renders an empty rail for no steps', () => {
        renderStepper({ steps: [] });
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    // EC-08 — `current` past the end must not silently mark every step done.
    it('survives a current beyond the last step', () => {
        expect(() =>
            renderStepper({ current: 9, maxReached: 9, steps })
        ).not.toThrow();
    });

    // BUG-design-system-09: two steps sharing a label are two steps, and React
    // must be able to tell them apart.
    it('renders every step when two share a label [design-system:I-35]', () => {
        const warn = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        renderStepper({
            steps: [
                { label: 'Details', hint: 'The workspace' },
                { label: 'Details', hint: 'The owner' },
                { label: 'Review', hint: 'Check it over' }
            ],
            current: 1,
            maxReached: 3
        });

        expect(screen.getAllByRole('button')).toHaveLength(3);
        expect(screen.getByText('The workspace')).toBeTruthy();
        expect(screen.getByText('The owner')).toBeTruthy();

        const keyWarnings = warn.mock.calls.filter((call) =>
            String(call[0]).includes('same key')
        );
        expect(keyWarnings).toEqual([]);
        warn.mockRestore();
    });
});
