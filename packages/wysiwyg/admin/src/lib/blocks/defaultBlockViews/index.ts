/**
 * The renderers for the built-in block types. One entry per
 * `DEFAULT_BLOCK_SCHEMA` definition — a consumer extending the schema passes
 * matching entries through `WysiwygEditor`'s `blockViews` prop, and the two
 * halves meet on the `type` key.
 */

import {
    AlignLeft,
    Code2,
    Columns2,
    Heading2,
    Image as ImageIcon,
    Link as LinkIcon,
    List,
    ListOrdered,
    ListTodo,
    Minus,
    MessageSquareQuote,
    PanelTopOpen,
    StickyNote,
    Table as TableIcon
} from 'lucide-react';
import { BLOCK_TYPE } from '@ortha-cms/wysiwyg-core';
import type { BlockViewRegistry } from '../blockRegistry';
import { ParagraphBlock } from '../renderers/ParagraphBlock';
import { HeadingBlock } from '../renderers/HeadingBlock';
import { BulletedListBlock } from '../renderers/BulletedListBlock';
import { NumberedListBlock } from '../renderers/NumberedListBlock';
import { TodoBlock } from '../renderers/TodoBlock';
import { QuoteBlock } from '../renderers/QuoteBlock';
import { CalloutBlock } from '../renderers/CalloutBlock';
import { CodeBlock } from '../renderers/CodeBlock';
import { DividerBlock } from '../renderers/DividerBlock';
import { ImageBlock } from '../renderers/ImageBlock';
import { EmbedBlock } from '../renderers/EmbedBlock';
import { ToggleBlock } from '../renderers/ToggleBlock';
import { ColumnsBlock } from '../renderers/ColumnsBlock';
import { ColumnBlock } from '../renderers/ColumnBlock';
import { TableBlock } from '../renderers/TableBlock';

/** The stock renderers. */
export const DEFAULT_BLOCK_VIEWS: BlockViewRegistry = {
    [BLOCK_TYPE.Paragraph]: { Component: ParagraphBlock, Icon: AlignLeft },
    [BLOCK_TYPE.Heading]: { Component: HeadingBlock, Icon: Heading2 },
    [BLOCK_TYPE.BulletedList]: { Component: BulletedListBlock, Icon: List },
    [BLOCK_TYPE.NumberedList]: {
        Component: NumberedListBlock,
        Icon: ListOrdered
    },
    [BLOCK_TYPE.Todo]: { Component: TodoBlock, Icon: ListTodo },
    [BLOCK_TYPE.Quote]: { Component: QuoteBlock, Icon: MessageSquareQuote },
    [BLOCK_TYPE.Callout]: { Component: CalloutBlock, Icon: StickyNote },
    [BLOCK_TYPE.Code]: { Component: CodeBlock, Icon: Code2 },
    [BLOCK_TYPE.Divider]: { Component: DividerBlock, Icon: Minus },
    [BLOCK_TYPE.Image]: { Component: ImageBlock, Icon: ImageIcon },
    [BLOCK_TYPE.Embed]: { Component: EmbedBlock, Icon: LinkIcon },
    [BLOCK_TYPE.Toggle]: {
        Component: ToggleBlock,
        Icon: PanelTopOpen,
        // The body belongs *inside* the disclosure, and only when it is open.
        rendersChildren: true
    },
    [BLOCK_TYPE.Columns]: {
        Component: ColumnsBlock,
        Icon: Columns2,
        rendersChildren: true
    },
    [BLOCK_TYPE.Column]: {
        Component: ColumnBlock,
        Icon: Columns2,
        rendersChildren: true
    },
    // Rows and cells have to be real `<tr>`/`<td>` elements, so the table
    // renders them itself rather than letting `BlockRow` wrap each in a `<div>`.
    [BLOCK_TYPE.Table]: {
        Component: TableBlock,
        Icon: TableIcon,
        rendersChildren: true
    }
};
