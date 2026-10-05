import * as React from 'react';

/**
 * How dense the controls below are. `compact` steps every control one notch
 * down — a `Button`'s size, the height of an `InputGroup`, a `SelectTrigger`
 * and a toolbar `SegmentedControl` — so a region with a shorter line box (the
 * top bar, a list's toolbar) can hold its controls without each caller
 * re-sizing them for wherever they happen to be drawn.
 */
type Density = 'default' | 'compact';

const DensityContext = React.createContext<Density>('default');

/** Sets the {@link Density} for every control rendered inside it. */
function DensityProvider({
    density,
    children
}: {
    density: Density;
    children: React.ReactNode;
}) {
    return (
        <DensityContext.Provider value={density}>
            {children}
        </DensityContext.Provider>
    );
}

/** The {@link Density} in force here — `default` outside any provider. */
function useDensity(): Density {
    return React.useContext(DensityContext);
}

export { DensityProvider, useDensity };
export type { Density };
