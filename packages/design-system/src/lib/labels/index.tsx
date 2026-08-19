import * as React from 'react';

/**
 * The strings the design system has to render on the user's behalf, for
 * controls that are pure iconography and therefore *are* nothing but their
 * accessible name.
 *
 * The library stays intl-agnostic on purpose — it has no `react-intl` and no
 * catalogue — so these ship as English defaults and the host overrides them
 * once. That is the whole point: before this, every default was a hard-coded
 * English literal a consumer could only replace by passing a prop at each of
 * twenty-odd call sites, and none of them did. A German session got German
 * chrome around an English "Close", announced with German phonetics and no
 * `lang` marking the switch — WCAG 3.1.2 (`ORT-159`).
 *
 * A per-call-site prop still wins where one is passed; this is the default
 * underneath it, not a replacement for naming a control something specific.
 */
export type DesignSystemLabels = {
    /** Accessible name for a dialog's or sheet's corner close button. */
    close: string;
};

/** The English defaults, used when no {@link DesignSystemLabelsProvider} is above. */
const DEFAULT_LABELS: DesignSystemLabels = {
    close: 'Close'
};

const DesignSystemLabelsContext =
    React.createContext<DesignSystemLabels>(DEFAULT_LABELS);

/**
 * Supplies localized {@link DesignSystemLabels} to everything below it.
 *
 * The admin host mounts one of these inside its `IntlProvider` and fills it from
 * `react-intl`, so the library's built-in chrome speaks the session's language
 * without the library depending on an i18n runtime. Partial: anything omitted
 * keeps its English default, so adding a key here is not a breaking change for
 * a consumer that has not heard of it yet.
 */
export function DesignSystemLabelsProvider({
    labels,
    children
}: {
    labels: Partial<DesignSystemLabels>;
    children: React.ReactNode;
}) {
    const value = React.useMemo(
        () => ({ ...DEFAULT_LABELS, ...labels }),
        [labels]
    );

    return (
        <DesignSystemLabelsContext.Provider value={value}>
            {children}
        </DesignSystemLabelsContext.Provider>
    );
}

/** Reads the current {@link DesignSystemLabels}. */
export function useDesignSystemLabels(): DesignSystemLabels {
    return React.useContext(DesignSystemLabelsContext);
}
