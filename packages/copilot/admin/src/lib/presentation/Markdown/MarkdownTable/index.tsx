import { defineMessages, useIntl } from 'react-intl';
import type { TableBlock } from '../parseBlocks';
import { renderInline } from '../renderInline';

const messages = defineMessages({
    // A table in an answer has no caption to take a name from — the model wrote
    // a pipe table, not a titled figure — so the name says what it is. Without
    // one, a screen reader announces "table with 6 columns" and nothing else.
    label: {
        id: 'copilot.markdown.table',
        defaultMessage: 'Table in this answer'
    }
});

/**
 * A pipe table from a model answer.
 *
 * Its own component rather than a branch of `renderBlock` because it is the one
 * block that needs `useIntl` — and because the three accessibility properties
 * below are easy to lose in a switch statement:
 *
 * - **`scope="col"` on every `<th>`.** Without it, moving between cells in a
 *   screen reader's table mode announces bare values with no column header, so
 *   a six-column content-type table reads as a list of unlabelled strings.
 * - **An accessible name on the `<table>`.**
 * - **A keyboard-reachable scroll region.** The wrapper scrolls horizontally
 *   because the docked panel is 420px and a content-type table is not; a
 *   scroll container with no `tabindex` is one a keyboard-only user cannot
 *   move (2.1.1), so the columns past the fold are unreachable without a mouse.
 *
 * These are the same three the design-system `Table` already gets right; this
 * renderer is hand-rolled and got none of them.
 */
export function MarkdownTable({ block }: { block: TableBlock }) {
    const intl = useIntl();
    const label = intl.formatMessage(messages.label);

    return (
        // The panel is narrow and a content-type table is wide, so the table
        // scrolls inside its own container rather than making the whole
        // transcript scroll sideways.
        <div
            role="region"
            aria-label={label}
            tabIndex={0}
            className="border-border focus-visible:ring-ring overflow-x-auto rounded-md border focus-visible:ring-2 focus-visible:outline-none"
        >
            <table
                aria-label={label}
                className="w-full border-collapse text-xs"
            >
                {/* A tinted header and a rule beneath it, matching the design
                    system's own `Table`. Type is `text-xs` but full-strength
                    `text-foreground`, not muted: this is data the user asked
                    for, and small text is exactly where a dimmed colour stops
                    being readable. */}
                <thead className="bg-muted/50">
                    <tr className="border-border border-b">
                        {block.header.map((cell, index) => (
                            <th
                                key={index}
                                scope="col"
                                className="px-2.5 py-1.5 font-semibold whitespace-nowrap"
                                style={{
                                    textAlign: block.align[index] ?? 'left'
                                }}
                            >
                                {renderInline(cell)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {block.rows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className="border-border/60 border-b last:border-0"
                        >
                            {row.map((cell, index) => (
                                <td
                                    key={index}
                                    className="px-2.5 py-1.5 align-top"
                                    style={{
                                        textAlign: block.align[index] ?? 'left'
                                    }}
                                >
                                    {renderInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
