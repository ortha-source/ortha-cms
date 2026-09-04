import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEQUENTIAL_TONES, toneBackground, type ChartTone } from './index';

/**
 * The palette and width utilities, checked as *source text*.
 *
 * This is the one invariant in the package that a rendered DOM cannot state.
 * `toneBackground('q3')` returns `'bg-chart-q3'` whether the table is a literal
 * or is built as `` `bg-chart-${tone}` `` — the markup is identical either way.
 * What differs is what Tailwind emits: it scans source text and never generates
 * a class it has not literally seen, so the interpolated version compiles to a
 * stylesheet with no `bg-chart-q3` in it and the bars render transparent. The
 * only observable that separates the two is the file.
 */

// Vitest serves specs over its own dev server, so `import.meta.url` is an
// http: URL here; the config's `root` is the package directory instead.
const SRC = join(process.cwd(), 'src');
const CHART_TONE = join(SRC, 'lib/utils/chartTone/index.ts');
const SECTION_BAND = join(
    SRC,
    'lib/presentation/components/InsightsSectionBand/index.tsx'
);

const ALL_TONES: ChartTone[] = ['series-1', 'series-2', ...SEQUENTIAL_TONES];

/**
 * Drops comments before scanning. Both files *explain* the interpolation they
 * avoid — quoting `` `bg-chart-${tone}` `` in prose is the clearest way to say
 * what must not be written — and a scan that could not tell the warning from
 * the mistake would fail on the very comment documenting the rule.
 */
const code = (file: string) =>
    readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

describe('chart palette classes', () => {
    const source = code(CHART_TONE);

    it('names every tone utility in full in the source [insights:I-21]', () => {
        for (const tone of ALL_TONES) {
            const utility = toneBackground(tone);
            expect(utility).toMatch(/^bg-chart-[\w-]+$/);
            // The assertion that bites: a generated table returns this string
            // at runtime while the file contains only the template it came from.
            expect(source).toContain(`'${utility}'`);
        }
    });

    it('composes no class name from a tone [insights:I-21]', () => {
        expect(source).not.toMatch(/`[^`]*\$\{[^}]*\}[^`]*`/);
    });
});

describe('widget width classes', () => {
    const source = code(SECTION_BAND);

    it('names every span in full in the source [insights:I-21]', () => {
        // The five sizes, as the grid means them: xs 3 twelfths, sm 4, md 6,
        // lg 8, full 12 — each written out with its breakpoint prefixes rather
        // than assembled from the number.
        for (const span of [
            'col-span-6 lg:col-span-3',
            'col-span-12 md:col-span-6 lg:col-span-4',
            'col-span-12 lg:col-span-6',
            'col-span-12 lg:col-span-8',
            'col-span-12'
        ]) {
            expect(source).toContain(`'${span}'`);
        }
    });

    it('composes no span from a column count [insights:I-21]', () => {
        expect(source).not.toMatch(/col-span-\$\{/);
        expect(source).not.toMatch(/`[^`]*col-span[^`]*`/);
    });
});
