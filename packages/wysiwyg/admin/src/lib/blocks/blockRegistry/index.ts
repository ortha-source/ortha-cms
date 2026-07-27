/**
 * The **renderer registry** — the admin-side half of a block type.
 *
 * `@ortha-cms/wysiwyg-core` says what a block *is* (its model, its HTML); this
 * says what it *looks like*. The two are keyed by the same `type` string and
 * are otherwise independent, which is what lets the core stay framework-free
 * and lets a consumer add a block type by registering a definition here and a
 * definition there — with no change to the editor itself.
 */

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BlockPath, WysiwygBlock } from '@ortha-cms/wysiwyg-core';

/** What every block renderer receives. */
export interface BlockViewProps {
    readonly block: WysiwygBlock;
    readonly path: BlockPath;
    /**
     * Placeholder for the block's own text, when the surrounding list decided
     * one is warranted (an empty document's first line, not every blank line).
     */
    readonly placeholder?: string;
}

/** One block type's rendering. */
export interface BlockView {
    /** The React component drawing the block. */
    readonly Component: ComponentType<BlockViewProps>;
    /** The icon standing for the type in menus. */
    readonly Icon: LucideIcon;
    /**
     * Whether the component draws its own `children`. Containers (a toggle's
     * body, a column) place them somewhere specific; everything else lets the
     * row render them as an indented list underneath.
     */
    readonly rendersChildren?: boolean;
}

/** A set of renderers, keyed by block type. */
export type BlockViewRegistry = Readonly<Record<string, BlockView>>;
