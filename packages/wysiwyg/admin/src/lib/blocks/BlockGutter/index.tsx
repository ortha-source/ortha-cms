import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    PARAGRAPH_TYPE,
    blockAt,
    createBlock,
    type BlockPath,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import { Button, cn } from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import { pathKey } from '../../utils/constants';
import { firstLineCenter } from '../../utils/first-line';
import { BlockMenu } from '../../menus/BlockMenu';

const messages = defineMessages({
    insert: {
        id: 'wysiwyg.gutter.insert',
        defaultMessage: 'Add a block below'
    }
});

/** The gap between the gutter and the text it belongs to. */
const GUTTER_GAP = 4;

/** Where the gutter is, and which block it is therefore acting on. */
interface GutterSpot {
    readonly path: BlockPath;
    /** Pixels from the surface's top/left corner. */
    readonly top: number;
    readonly left: number;
    /** Shown, or fading out where it last was. */
    readonly visible: boolean;
    /** Travel to this spot, rather than appearing at it. */
    readonly animate: boolean;
}

/**
 * The add + drag controls, as **one** element for the whole document that
 * travels to whichever block the author is on.
 *
 * A per-row gutter — one hidden control in every row, revealed on hover — meant
 * the pair blinked out of one line and back into the next on every crossing,
 * which reads as flicker down a document rather than as one thing following the
 * cursor. Moving one element keeps the affordance continuous: it is the same
 * two buttons throughout, and where they are going is legible.
 *
 * The cost is DOM adjacency. The controls no longer sit inside the row they act
 * on, so they are no longer the next thing a keyboard user Tabs to from a
 * block — see the note in AGENTS.md.
 */
export function BlockGutter({
    blocks,
    surfaceRef
}: {
    /** The document, for resolving the block the gutter is parked on. */
    blocks: readonly WysiwygBlock[];
    /** The positioned element the gutter is placed within. */
    surfaceRef: RefObject<HTMLElement | null>;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const gutterRef = useRef<HTMLDivElement>(null);
    const [spot, setSpot] = useState<GutterSpot | null>(null);

    const moveTo = useCallback(
        (row: HTMLElement) => {
            const surface = surfaceRef.current;
            const path = parsePath(row.getAttribute('data-block-path'));
            if (!surface || !path) return;
            const { top, left } = placeOn(row, surface);
            setSpot((previous) => ({
                path,
                top,
                left,
                visible: true,
                // Appearing is a fade in place; only a move between blocks is
                // worth animating, or every re-entry slides in from wherever
                // the author last left it.
                animate: previous?.visible === true
            }));
        },
        [surfaceRef]
    );

    useEffect(() => {
        const surface = surfaceRef.current;
        if (!surface) return;

        /** The row an event happened in — or nothing, to leave the gutter be. */
        const rowFor = (target: EventTarget | null): HTMLElement | null => {
            if (!(target instanceof Element)) return null;
            // Reaching for the controls must not count as leaving the block
            // they belong to.
            if (gutterRef.current?.contains(target)) return null;
            return target.closest<HTMLElement>('[data-block-path]');
        };

        const handleMove = (event: Event) => {
            const row = rowFor(event.target);
            if (row) moveTo(row);
        };

        const handlePointerLeave = () => {
            // Not while the author is *in* the controls: the pointer leaves the
            // surface to reach an open menu.
            if (gutterRef.current?.contains(document.activeElement)) return;
            setSpot((previous) =>
                previous ? { ...previous, visible: false } : null
            );
        };

        surface.addEventListener('pointerover', handleMove);
        surface.addEventListener('focusin', handleMove);
        surface.addEventListener('pointerleave', handlePointerLeave);
        return () => {
            surface.removeEventListener('pointerover', handleMove);
            surface.removeEventListener('focusin', handleMove);
            surface.removeEventListener('pointerleave', handlePointerLeave);
        };
    }, [moveTo, surfaceRef]);

    // An edit under the parked gutter moves the line it is centred on — turning
    // the block into a heading is the obvious one — and deleting that block
    // leaves it pointing at nothing.
    useLayoutEffect(() => {
        setSpot((previous) => {
            const surface = surfaceRef.current;
            if (!previous || !surface) return previous;
            const row = surface.querySelector<HTMLElement>(
                `[data-block-path="${pathKey(previous.path)}"]`
            );
            if (!row) return null;
            const { top, left } = placeOn(row, surface);
            if (top === previous.top && left === previous.left) return previous;
            return { ...previous, top, left, animate: true };
        });
    }, [blocks, surfaceRef]);

    const block = spot ? blockAt(blocks, spot.path) : null;
    if (!spot || !block) return null;

    return (
        <div
            ref={gutterRef}
            style={{
                // The whole point: the position is a transform, so moving to
                // the next block is something the compositor can animate.
                // `-100%` hangs it off the left of the text rather than over
                // it, `-50%` centres it on the line.
                transform: `translate(${spot.left - GUTTER_GAP}px, ${spot.top}px) translate(-100%, -50%)`,
                transitionProperty: spot.animate
                    ? 'transform, opacity'
                    : 'opacity'
            }}
            className={cn(
                'absolute top-0 left-0 flex gap-0.5 duration-150 ease-out',
                spot.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
        >
            <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={intl.formatMessage(messages.insert)}
                className="text-muted-foreground size-6"
                onClick={() =>
                    commands.insertAfter(spot.path, [
                        createBlock(PARAGRAPH_TYPE)
                    ])
                }
            >
                <Plus aria-hidden className="size-4" />
            </Button>
            <BlockMenu block={block} path={spot.path} />
        </div>
    );
}

/** A row's first line, as an offset within the surface. */
function placeOn(
    row: HTMLElement,
    surface: HTMLElement
): { top: number; left: number } {
    const rowRect = row.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return {
        top: rowRect.top - surfaceRect.top + firstLineCenter(row),
        // Follows the row, so a block nested three levels deep is flagged at
        // its own indent rather than at the document's margin.
        left: rowRect.left - surfaceRect.left
    };
}

/** `"1.0"` → `[1, 0]`, or nothing if it isn't a path. */
function parsePath(raw: string | null): BlockPath | null {
    if (!raw) return null;
    const path = raw.split('.').map(Number);
    return path.some(Number.isNaN) ? null : path;
}
