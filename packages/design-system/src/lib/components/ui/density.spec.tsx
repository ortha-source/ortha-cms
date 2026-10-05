import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { DensityProvider } from './density';
import { InputGroup, InputGroupInput } from './input-group';
import { SegmentedControl, SegmentedControlItem } from './segmented-control';

/**
 * Compact density is a promise about a whole region — the top bar, a list's
 * toolbar — so what is pinned is that every control in it steps down together,
 * and that the field variant of `SegmentedControl` does not: it is a form
 * control and keeps matching `Input`, wherever it is drawn. A control that
 * forgot to read the context would sit 4px proud of its neighbours, which no
 * page test would notice.
 */
describe('DensityProvider', () => {
    it('steps a toolbar’s controls down together', () => {
        render(
            <DensityProvider density="compact">
                <Button>Filters</Button>
                <Button size="icon" aria-label="More" />
                <InputGroup data-testid="search">
                    <InputGroupInput aria-label="Search" />
                </InputGroup>
                <SegmentedControl aria-label="Status" data-testid="toolbar">
                    <SegmentedControlItem value="all">All</SegmentedControlItem>
                </SegmentedControl>
            </DensityProvider>
        );

        expect(
            screen.getByRole('button', { name: 'Filters' }).className
        ).toContain('h-8');
        expect(
            screen.getByRole('button', { name: 'More' }).className
        ).toContain('size-8');
        expect(screen.getByTestId('search').className).toContain('h-8');
        expect(screen.getByTestId('toolbar').className).toContain('h-8');
    });

    it('leaves the field variant of a segmented control at field height', () => {
        render(
            <DensityProvider density="compact">
                <SegmentedControl
                    variant="field"
                    aria-label="Enabled"
                    data-testid="field"
                >
                    <SegmentedControlItem value="on">On</SegmentedControlItem>
                </SegmentedControl>
            </DensityProvider>
        );

        expect(screen.getByTestId('field').className).toContain('h-9');
        expect(screen.getByTestId('field').className).not.toContain('h-8');
    });

    it('changes nothing outside a provider', () => {
        render(<Button>Save</Button>);

        expect(
            screen.getByRole('button', { name: 'Save' }).className
        ).toContain('h-9');
    });
});
