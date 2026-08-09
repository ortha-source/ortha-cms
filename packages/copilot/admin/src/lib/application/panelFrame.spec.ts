import {
    clampFrame,
    isPanelFrame,
    moveFrame,
    resizeFrame,
    MIN_PANEL_HEIGHT,
    MIN_PANEL_WIDTH,
    type PanelFrame
} from './panelFrame';

const VIEWPORT = { width: 1280, height: 800 };

function frame(overrides: Partial<PanelFrame> = {}): PanelFrame {
    return { x: 400, y: 200, width: 420, height: 400, ...overrides };
}

describe('clampFrame', () => {
    it('leaves a frame that already fits alone', () => {
        expect(clampFrame(frame(), VIEWPORT)).toEqual(frame());
    });

    it('slides a frame back on screen rather than shrinking it', () => {
        // The size is what the user chose; the position is incidental. A saved
        // frame opened on a smaller monitor should arrive intact and moved.
        const clamped = clampFrame(frame({ x: 1200, y: 700 }), VIEWPORT);
        expect(clamped).toEqual({ x: 860, y: 400, width: 420, height: 400 });
    });

    it('never leaves the panel above or left of the viewport', () => {
        expect(clampFrame(frame({ x: -300, y: -80 }), VIEWPORT)).toMatchObject({
            x: 0,
            y: 0
        });
    });

    it('shrinks only when the viewport itself is smaller than the panel', () => {
        const clamped = clampFrame(frame({ width: 900, height: 900 }), {
            width: 600,
            height: 500
        });
        expect(clamped).toEqual({ x: 0, y: 0, width: 600, height: 500 });
    });

    it('honours the minimum size even in a viewport smaller than it', () => {
        // The lower bound wins over the upper one: sizing the panel to a
        // 200px-wide window would be correct arithmetic and an unusable panel.
        expect(clampFrame(frame(), { width: 200, height: 150 })).toMatchObject({
            width: 200,
            height: 150
        });
    });

    it('rounds to whole pixels', () => {
        expect(
            clampFrame(frame({ x: 100.4, y: 50.6, width: 420.5 }), VIEWPORT)
        ).toEqual({ x: 100, y: 51, width: 421, height: 400 });
    });
});

describe('moveFrame', () => {
    it('applies the delta', () => {
        expect(moveFrame(frame(), 40, -30, VIEWPORT)).toMatchObject({
            x: 440,
            y: 170
        });
    });

    it('stops at the edge without resizing', () => {
        const moved = moveFrame(frame(), 10_000, 10_000, VIEWPORT);
        expect(moved).toEqual({ x: 860, y: 400, width: 420, height: 400 });
    });
});

describe('resizeFrame', () => {
    it('grows east without moving the left edge', () => {
        expect(resizeFrame(frame(), 'e', 100, 0, VIEWPORT)).toEqual({
            x: 400,
            y: 200,
            width: 520,
            height: 400
        });
    });

    it('grows west by moving the left edge, keeping the right one fixed', () => {
        const resized = resizeFrame(frame(), 'w', -100, 0, VIEWPORT);
        expect(resized).toMatchObject({ x: 300, width: 520 });
        expect(resized.x + resized.width).toBe(820);
    });

    it('grows north by moving the top edge, keeping the bottom one fixed', () => {
        const resized = resizeFrame(frame(), 'n', -50, -50, VIEWPORT);
        expect(resized).toMatchObject({ y: 150, height: 450 });
        expect(resized.y + resized.height).toBe(600);
    });

    it('resizes both axes from a corner', () => {
        expect(resizeFrame(frame(), 'se', 60, 40, VIEWPORT)).toEqual({
            x: 400,
            y: 200,
            width: 480,
            height: 440
        });
    });

    it('stops the west edge dead at the minimum instead of towing the panel', () => {
        // The regression this exists for: clamping the *width* after moving `x`
        // drags the whole window right once the minimum is reached, so pulling
        // the left edge past its limit slides the panel across the screen.
        const resized = resizeFrame(frame(), 'w', 10_000, 0, VIEWPORT);
        expect(resized.width).toBe(MIN_PANEL_WIDTH);
        expect(resized.x + resized.width).toBe(820);
    });

    it('stops the north edge dead at the minimum', () => {
        const resized = resizeFrame(frame(), 'n', 0, 10_000, VIEWPORT);
        expect(resized.height).toBe(MIN_PANEL_HEIGHT);
        expect(resized.y + resized.height).toBe(600);
    });

    it('caps an east drag at the viewport instead of sliding the panel left', () => {
        const resized = resizeFrame(frame(), 'e', 10_000, 0, VIEWPORT);
        expect(resized).toMatchObject({ x: 400, width: 880 });
    });

    it('ignores the axis the edge does not name', () => {
        expect(resizeFrame(frame(), 'e', 100, 999, VIEWPORT)).toMatchObject({
            height: 400
        });
    });
});

describe('isPanelFrame', () => {
    it('accepts a well-formed frame', () => {
        expect(isPanelFrame(frame())).toBe(true);
    });

    it.each([
        ['null', null],
        ['a string', '{"x":1}'],
        ['a missing field', { x: 1, y: 2, width: 3 }],
        ['NaN', { x: NaN, y: 2, width: 3, height: 4 }],
        ['Infinity', { x: 1, y: 2, width: Infinity, height: 4 }],
        ['a stringified number', { x: '1', y: 2, width: 3, height: 4 }]
    ])('rejects %s', (_label, value) => {
        expect(isPanelFrame(value)).toBe(false);
    });
});
