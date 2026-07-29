/**
 * The default block set. Registration order matters in exactly one place —
 * two definitions claiming the same tag are tried in order — so the narrower
 * ones (a to-do `<li>`, an embed `<figure>`) come before the general ones.
 */

import { createBlockSchema, type BlockSchema } from '../schema';
import {
    calloutBlock,
    headingBlock,
    paragraphBlock,
    quoteBlock
} from './text-blocks';
import {
    bulletedListBlock,
    numberedListBlock,
    todoBlock
} from './list-blocks';
import { dividerBlock, embedBlock, imageBlock } from './media-blocks';
import {
    codeBlock,
    columnBlock,
    columnsBlock,
    toggleBlock
} from './structure-blocks';
import {
    tableBlock,
    tableCellBlock,
    tableRowBlock
} from './table-blocks';

/** Every built-in definition, in match-priority order. */
export const DEFAULT_BLOCK_DEFINITIONS = [
    paragraphBlock,
    headingBlock,
    todoBlock,
    bulletedListBlock,
    numberedListBlock,
    quoteBlock,
    calloutBlock,
    codeBlock,
    dividerBlock,
    embedBlock,
    imageBlock,
    toggleBlock,
    columnsBlock,
    columnBlock,
    tableBlock,
    tableRowBlock,
    tableCellBlock
] as const;

/** The schema an editor uses unless it is given one. */
export const DEFAULT_BLOCK_SCHEMA: BlockSchema = createBlockSchema(
    DEFAULT_BLOCK_DEFINITIONS
);

export {
    paragraphBlock,
    headingBlock,
    quoteBlock,
    calloutBlock,
    bulletedListBlock,
    numberedListBlock,
    todoBlock,
    dividerBlock,
    imageBlock,
    embedBlock,
    codeBlock,
    toggleBlock,
    columnsBlock,
    columnBlock,
    tableBlock,
    tableRowBlock,
    tableCellBlock
};
export {
    createTable,
    createTableCell,
    createTableRow,
    isHeaderRow
} from './table-blocks';
