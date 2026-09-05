import type { ReactNode } from 'react';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdmin } from '.';

/**
 * **The host's own missing-translation handler**, reached directly rather than
 * through `IntlProvider`.
 *
 * `index.spec.tsx` drives the handler the way the app does — format an
 * untranslated descriptor and read the console — and that is right for the
 * once-per-id and warn-not-error clauses. It is the *wrong* instrument for the
 * third one. `react-intl` suppresses `MISSING_TRANSLATION` itself when
 * `locale.toLowerCase() === defaultLocale.toLowerCase()`
 * (`@formatjs/intl/lib/src/message.js`), so with the real provider in place the
 * handler is never called at all in that case: the assertion passes, and it
 * passes just as happily against a host whose own `if (locale ===
 * defaultLocale) return` has been deleted. Verified by mutation before this file
 * existed — the suite stayed green.
 *
 * That is a badly chosen observable, not an unreachable clause. The host's guard
 * is a function of two strings; what hid it was insisting on calling it through
 * a library that answers first. So `IntlProvider` is replaced by a component
 * that does nothing but hand back the `onError` it was given, and the handler is
 * then called with the error `react-intl` would have raised.
 *
 * The rest of `react-intl` stays real apart from `useIntl`, which has no
 * provider to read once the real one is gone.
 */

/** The `onError` the host passed to its `IntlProvider` on the last boot. */
const captured = vi.hoisted(() => ({
    onError: undefined as ((error: Error) => void) | undefined
}));

vi.mock('react-intl', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-intl')>();
    return {
        ...actual,
        IntlProvider: ({
            children,
            onError
        }: {
            children: ReactNode;
            onError?: (error: Error) => void;
        }) => {
            captured.onError = onError;
            return <>{children}</>;
        },
        // `DesignSystemLabels` formats one descriptor under the provider that is
        // no longer there. It is not what this file is about, so it gets the
        // default message back.
        useIntl: () => ({
            formatMessage: (descriptor: { defaultMessage?: string }) =>
                descriptor.defaultMessage ?? ''
        })
    };
});

/**
 * The error `react-intl` raises for an untranslated descriptor — the same
 * `code` and `descriptor` shape the handler reads.
 */
function missingTranslation(id: string): Error {
    return Object.assign(new Error(`Missing message: "${id}"`), {
        code: 'MISSING_TRANSLATION',
        descriptor: { id }
    });
}

/** Boots the host with a mount point and returns the handler it installed. */
function bootAndTakeHandler(locale: string): (error: Error) => void {
    const container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);

    act(() => {
        createAdmin({ plugins: [], locale });
    });

    const handler = captured.onError;
    if (!handler) {
        throw new Error(
            'createAdmin mounted no onError on its IntlProvider; the host no longer installs a handler.'
        );
    }
    return handler;
}

/**
 * Console lines the *host* wrote. React Router logs two future-flag warnings on
 * every boot, and they would otherwise make "said nothing" unreachable.
 */
const fromHost = (lines: string[]): string[] =>
    lines.filter((line) => line.includes('[bootstrap-admin]'));

describe('the host’s missing-translation handler', () => {
    let warned: string[];
    let errored: string[];

    beforeEach(() => {
        captured.onError = undefined;
        warned = [];
        errored = [];
        vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
            warned.push(String(args[0]));
        });
        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errored.push(String(args[0]));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('says nothing at all when the locale is the default [bootstrap:I-34]', () => {
        const report = bootAndTakeHandler('en');

        report(missingTranslation('bootstrap.spec.untranslated'));

        // An `en` session resolving an `en` `defaultMessage` is the expected
        // path, not a gap to fill — and it is *every* descriptor on every
        // render, so reporting it would be the 460-line console ORT-141 was
        // about, with nothing actionable in it.
        expect(fromHost(warned)).toEqual([]);
        expect(errored).toEqual([]);
    });

    it('reports the same id once the locale differs [bootstrap:I-34]', () => {
        // The control: the identical error, through the identical handler,
        // differing only in the locale the host was booted with. Without it the
        // case above would hold for a handler that reports nothing ever.
        const report = bootAndTakeHandler('de');

        report(missingTranslation('bootstrap.spec.untranslated'));
        report(missingTranslation('bootstrap.spec.untranslated'));

        expect(fromHost(warned)).toHaveLength(1);
        expect(fromHost(warned)[0]).toContain('no "de" translation');
        expect(fromHost(warned)[0]).toContain('bootstrap.spec.untranslated');
        expect(errored).toEqual([]);
    });

    it('passes a real formatting error through untouched, in any locale [bootstrap:I-34]', () => {
        const report = bootAndTakeHandler('en');

        // Not a `MISSING_TRANSLATION`: an unparseable ICU argument, a bad tag.
        // The default-locale guard must not swallow those — they are bugs in
        // the descriptor, and the fallback rendered is wrong rather than merely
        // untranslated.
        report(new Error('INVALID_CONFIG: malformed message'));

        expect(errored).toHaveLength(1);
        expect(fromHost(warned)).toEqual([]);
    });
});
