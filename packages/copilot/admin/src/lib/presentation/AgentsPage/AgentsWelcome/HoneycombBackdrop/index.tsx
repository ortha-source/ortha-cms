import { useId } from 'react';

/**
 * Side length of one cell, in user units.
 *
 * Large on purpose. At half this it tiled into texture — legible as *pattern*
 * but not as hexagons, which is the difference between a backdrop and a shade
 * of grey. A few big cells read as structure; many small ones read as noise.
 */
const SIDE = 34;

/** Horizontal pitch of a pointy-top hexagon: its width, √3·s. */
const TILE_WIDTH = Math.sqrt(3) * SIDE;

/**
 * Vertical pitch of the repeating tile.
 *
 * Rows of a pointy-top honeycomb sit `1.5·s` apart and alternate their
 * horizontal offset, so the grid only repeats every **two** rows — `3·s`.
 */
const TILE_HEIGHT = 3 * SIDE;

/**
 * The centres inside one tile.
 *
 * Five, not one: a hexagon straddles the tile's edges, so the ones on the
 * boundary have to be drawn from both sides for the pattern to meet seamlessly.
 * Row 0 and row 2 are aligned (the tile's top and bottom edges); row 1 is offset
 * by half a width, which is what makes it a honeycomb rather than a grid.
 */
const CENTRES: readonly (readonly [number, number])[] = [
    [0, 0],
    [TILE_WIDTH, 0],
    [TILE_WIDTH / 2, 1.5 * SIDE],
    [0, TILE_HEIGHT],
    [TILE_WIDTH, TILE_HEIGHT]
];

/** One pointy-top hexagon, as an SVG path. */
function hexagon(cx: number, cy: number, side: number): string {
    const dx = (Math.sqrt(3) * side) / 2;
    const dy = side / 2;
    const points: [number, number][] = [
        [cx, cy - side],
        [cx + dx, cy - dy],
        [cx + dx, cy + dy],
        [cx, cy + side],
        [cx - dx, cy + dy],
        [cx - dx, cy - dy]
    ];
    return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`;
}

/**
 * The abstract lattice behind the Agents view's empty state.
 *
 * A honeycomb because that is what the surface *is*: a workspace's content is a
 * lattice of small things that fit together, and the copilot works across it.
 * It reads as structure rather than decoration, which is the only excuse for
 * putting a pattern behind a greeting at all.
 *
 * Three things keep it from becoming noise:
 *
 * - **It is drawn in `--color-border`**, the same hairline grey as every divider
 *   and card edge in the admin, so it tints rather than draws. Not the brand
 *   orange: a full-panel lattice is far more surface than an accent is meant to
 *   cover, and it made the empty state read as a different product from the
 *   rest of the admin. Not the muted ink either — at this size that still read
 *   as a drawn grid rather than as ground.
 * - **A radial mask fades it out before the content starts.** The lattice haloes
 *   the greeting and has dissolved by the time the suggestion cards begin — the
 *   cards sit on clean ground, not on a grid.
 * - **`currentColor` and a token class**, so it follows the theme instead of
 *   being a light-mode decoration that turns into scratches on the dark canvas.
 *
 * Purely decorative, so `aria-hidden` and `pointer-events-none`: it is never a
 * tab stop, never announced, and never in the way of a click.
 */
export function HoneycombBackdrop() {
    // Two of these can be on screen at once (the page and a docked window), and
    // duplicate SVG ids make the second one reference the first's pattern.
    const id = useId();
    const cells = `${id}-cells`;
    const fade = `${id}-fade`;
    const mask = `${id}-mask`;

    return (
        <svg
            aria-hidden
            className="text-border pointer-events-none absolute inset-0 size-full"
        >
            <defs>
                <pattern
                    id={cells}
                    width={TILE_WIDTH}
                    height={TILE_HEIGHT}
                    patternUnits="userSpaceOnUse"
                >
                    {CENTRES.map(([cx, cy]) => (
                        <path
                            key={`${cx}-${cy}`}
                            d={hexagon(cx, cy, SIDE)}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1}
                        />
                    ))}
                </pattern>

                {/* Centred above the greeting, and gone by ~45% of the radius — which
                    is where the suggestion cards start. Tuned by looking at it:
                    a fade that reached them made the whole panel read as graph
                    paper rather than as a halo behind the greeting. */}
                <radialGradient id={fade} cx="50%" cy="27%" r="48%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.75" />
                    <stop offset="40%" stopColor="white" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>

                <mask id={mask}>
                    <rect width="100%" height="100%" fill={`url(#${fade})`} />
                </mask>
            </defs>

            <rect
                width="100%"
                height="100%"
                fill={`url(#${cells})`}
                mask={`url(#${mask})`}
            />
        </svg>
    );
}
