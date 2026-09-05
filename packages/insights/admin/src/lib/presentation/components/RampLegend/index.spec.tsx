import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { RampLegend } from './index';

/**
 * The sequential ramp's captions.
 *
 * The ramp's direction **flips between themes** — the busiest cell is the
 * darkest on the light card and the brightest on the dark one — so a caption
 * that names a direction of brightness is true in exactly one theme and false
 * in the other. "Colour intensifies with age" is fine; "darker means older" is
 * the bug, and it is a bug no screenshot diff catches, because whichever theme
 * the reviewer is in it reads correctly.
 *
 * The captions are supplied by the widget, in whichever package owns the data,
 * so the second test goes looking for the call sites rather than naming one.
 * It reads those packages as text; it does not import them, which would put a
 * feature package on this one's dependency list.
 */

/**
 * Words that assert a direction of brightness.
 *
 * **Stems, not only comparatives.** The list used to be the nine comparative
 * forms, which left "the deep end means older" and "shaded by age" passing —
 * the same claim, phrased without a `-er`. `light` is deliberately absent as a
 * bare stem (it is half of "highlight" and of "lighten the load"); its
 * comparatives are listed instead.
 */
const BRIGHTNESS = [
    'dark',
    'darker',
    'darkest',
    'darkness',
    'lighter',
    'lightest',
    'bright',
    'brighter',
    'brightest',
    'brightness',
    'dim',
    'dimmer',
    'dimmest',
    'pale',
    'paler',
    'palest',
    'faint',
    'fainter',
    'deep',
    'deeper',
    'deepest',
    'shade',
    'shaded',
    'shading'
];

const ADMIN_PACKAGES = join(process.cwd(), '../..');

/** Every admin-package source file that renders a `RampLegend`. */
function rampCallSites(): { file: string; source: string }[] {
    const sites: { file: string; source: string }[] = [];

    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(path);
                continue;
            }
            if (!/\.tsx$/.test(entry.name) || /\.spec\.tsx$/.test(entry.name)) {
                continue;
            }
            const source = readFileSync(path, 'utf8');
            if (source.includes('<RampLegend'))
                sites.push({ file: path, source });
        }
    };

    for (const group of readdirSync(ADMIN_PACKAGES, { withFileTypes: true })) {
        if (!group.isDirectory()) continue;
        const src = join(ADMIN_PACKAGES, group.name, 'admin/src');
        try {
            walk(src);
        } catch {
            // Not every group has an admin half; a missing tree is not a site.
        }
    }

    return sites;
}

describe('RampLegend', () => {
    it('renders the ramp low to high with the captions at its ends', () => {
        const { container } = render(
            <RampLegend lowLabel="quiet" highLabel="busy" />
        );

        expect(screen.getByText('quiet')).toBeTruthy();
        expect(screen.getByText('busy')).toBeTruthy();

        // Spelled out rather than mapped from `SEQUENTIAL_TONES`: derived from
        // the same constant the component reads, the expectation would follow a
        // reordered ramp instead of catching it.
        const swatches = [
            ...container.querySelectorAll('[class*="bg-chart-"]')
        ];
        expect(swatches.map((el) => el.className.split(' ').pop())).toEqual([
            'bg-chart-q0',
            'bg-chart-q1',
            'bg-chart-q2',
            'bg-chart-q3',
            'bg-chart-q4',
            'bg-chart-q5'
        ]);
    });

    it('takes its captions whole, so the scan below can see them [insights:I-23]', () => {
        // The premise the source scan rests on, and the one limb of the
        // judgment's "cannot see" that turned out to be enumerable: a caption
        // built at runtime — a template literal, a concatenation, a ternary
        // over the theme — is not a `defaultMessage` anywhere, so the scan
        // would read a file full of innocent copy and pass.
        //
        // It cannot be built at runtime if the props are only ever a bare
        // `formatMessage(<descriptor>)`, which is what this asserts. A caption
        // that needs assembling has to change this line first.
        const sites = rampCallSites();
        expect(sites.length).toBeGreaterThan(0);

        for (const { file, source } of sites) {
            const props = [
                ...source.matchAll(/(lowLabel|highLabel)=\{([^}]*)\}/g)
            ].map(([, name, expression]) => ({
                name,
                expression: expression.replace(/\s+/g, ' ').trim()
            }));

            expect({ file, count: props.length }).toEqual({ file, count: 2 });
            for (const { name, expression } of props) {
                expect({ file, name, expression }).toEqual({
                    file,
                    name,
                    expression: expect.stringMatching(
                        /^intl\.formatMessage\(messages\.[A-Za-z0-9_]+\)$/
                    )
                });
            }
        }
    });

    it('is captioned by magnitude, never by brightness [insights:I-23]', () => {
        const sites = rampCallSites();

        // The scan is only worth its assertions if it found the widget that
        // exists: the punchcard, in `content-admin`.
        expect(sites.length).toBeGreaterThan(0);

        for (const { file, source } of sites) {
            // Every `defaultMessage` in the file, not only the two handed to
            // the legend: the caption under the chart and the grid's text
            // alternative describe the same ramp and carry the same risk.
            const copy = [
                ...source.matchAll(/defaultMessage:\s*'((?:[^'\\]|\\.)*)'/g)
            ].map((match) => match[1]);
            expect(copy.length).toBeGreaterThan(0);

            const offending = BRIGHTNESS.filter((word) =>
                copy.some((message) =>
                    new RegExp(`\\b${word}\\b`, 'i').test(message)
                )
            );
            expect({ file, offending }).toEqual({ file, offending: [] });
        }
    });
});
