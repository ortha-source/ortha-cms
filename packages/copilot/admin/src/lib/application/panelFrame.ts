/**
 * Where the chat panel sits and how big it is, in **viewport pixels measured
 * from the top-left** — the coordinate space `position: fixed` + `left`/`top`
 * uses, so the values go straight into a style object with no conversion.
 *
 * The panel's default home is the bottom-right corner, expressed in CSS
 * (`fixed right-4 bottom-4`). A frame exists only once the user has dragged or
 * resized: `null` means "wherever the classes put it", which is why the panel
 * still lands correctly on a window it has never been opened in.
 */
export interface PanelFrame {
    /** Distance from the viewport's left edge. */
    x: number;
    /** Distance from the viewport's top edge. */
    y: number;
    width: number;
    height: number;
}

/** The space a frame has to fit inside. */
export interface Viewport {
    width: number;
    height: number;
}

/**
 * Which edge (or corner) a resize is pulling.
 *
 * Spelled as compass letters so a corner is literally the two edges it is made
 * of — `resizeFrame` tests `edge.includes('w')` rather than switching over
 * eight cases that each repeat the same arithmetic.
 */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * The narrowest the panel may get. Below this the composer's buttons wrap and
 * the tool steps stop being readable, so it is a usability floor rather than a
 * cosmetic one.
 */
export const MIN_PANEL_WIDTH = 320;

/** The shortest the panel may get: header, one exchange, and the composer. */
export const MIN_PANEL_HEIGHT = 240;

/**
 * Brings a frame back inside the viewport, **preserving its size in preference
 * to its position**.
 *
 * That order is what makes a saved frame survive a smaller monitor: the panel
 * slides in from the edge rather than being squashed, and it is only narrowed
 * when the viewport itself is narrower than the panel. Keeping the whole panel
 * on screen — rather than allowing it to hang off with a sliver visible — is
 * deliberate: this window has no other affordance for retrieving it, so a
 * dragged-off panel would be a lost panel.
 */
export function clampFrame(frame: PanelFrame, viewport: Viewport): PanelFrame {
    const width = clamp(
        frame.width,
        Math.min(MIN_PANEL_WIDTH, viewport.width),
        viewport.width
    );
    const height = clamp(
        frame.height,
        Math.min(MIN_PANEL_HEIGHT, viewport.height),
        viewport.height
    );
    return {
        x: Math.round(clamp(frame.x, 0, viewport.width - width)),
        y: Math.round(clamp(frame.y, 0, viewport.height - height)),
        width: Math.round(width),
        height: Math.round(height)
    };
}

/** The frame moved by a pointer delta, still on screen. */
export function moveFrame(
    frame: PanelFrame,
    dx: number,
    dy: number,
    viewport: Viewport
): PanelFrame {
    return clampFrame({ ...frame, x: frame.x + dx, y: frame.y + dy }, viewport);
}

/**
 * The frame with one edge pulled by a pointer delta.
 *
 * The two halves are not symmetric, and the asymmetry is the whole content of
 * this function. Dragging the **east** or **south** edge moves that edge and
 * leaves the opposite one where it is, so the delta lands on the size. Dragging
 * **west** or **north** moves the origin *and* the size in opposite directions,
 * which means the limit is not "how small may this get" but "how far may this
 * edge travel before it passes the far one" — computed from the fixed edge, so
 * pulling past the minimum stops the edge dead instead of dragging the whole
 * panel along with it.
 */
export function resizeFrame(
    frame: PanelFrame,
    edge: ResizeEdge,
    dx: number,
    dy: number,
    viewport: Viewport
): PanelFrame {
    const minWidth = Math.min(MIN_PANEL_WIDTH, viewport.width);
    const minHeight = Math.min(MIN_PANEL_HEIGHT, viewport.height);
    let { x, y, width, height } = frame;

    if (edge.includes('e')) {
        width = clamp(width + dx, minWidth, viewport.width - x);
    }
    if (edge.includes('s')) {
        height = clamp(height + dy, minHeight, viewport.height - y);
    }
    if (edge.includes('w')) {
        const right = x + width;
        x = clamp(x + dx, 0, right - minWidth);
        width = right - x;
    }
    if (edge.includes('n')) {
        const bottom = y + height;
        y = clamp(y + dy, 0, bottom - minHeight);
        height = bottom - y;
    }

    return clampFrame({ x, y, width, height }, viewport);
}

/**
 * Whether a parsed value is a usable frame.
 *
 * The stored frame comes back from `localStorage`, which is user-writable and
 * survives across deploys — so it is untrusted input in the same sense a
 * request body is. Without this, a hand-edited or stale entry becomes
 * `left: NaN` and the panel opens somewhere the user cannot reach it.
 */
export function isPanelFrame(value: unknown): value is PanelFrame {
    if (!value || typeof value !== 'object') return false;
    const frame = value as Partial<PanelFrame>;
    return (
        isFinitePixel(frame.x) &&
        isFinitePixel(frame.y) &&
        isFinitePixel(frame.width) &&
        isFinitePixel(frame.height)
    );
}

function isFinitePixel(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
    // `max` before `min` on purpose: when the viewport is smaller than the
    // minimum size, `max < min` and the lower bound has to win, or the panel is
    // sized larger than the window it is being clamped into.
    return Math.max(min, Math.min(max, value));
}
