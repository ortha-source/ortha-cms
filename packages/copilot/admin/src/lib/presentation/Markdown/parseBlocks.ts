/**
 * The block parser behind {@link Markdown} — pure, so the interesting cases
 * (tables, partially-streamed blocks, ragged rows) are unit-tested without
 * rendering anything.
 */

/** Column alignment, from a table's `:---:` separator row. */
export type Align = 'left' | 'center' | 'right';

export type Block =
    | { kind: 'paragraph'; text: string }
    | { kind: 'heading'; level: number; text: string }
    | { kind: 'code'; language: string; code: string }
    | { kind: 'list'; ordered: boolean; items: string[] }
    | { kind: 'table'; header: string[]; align: Align[]; rows: string[][] };

/** A `|---|:--:|---:|` separator, which is what makes the line above a header. */
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/** Splits one `| a | b |` row into trimmed cells. */
function tableCells(line: string): string[] {
    let row = line.trim();
    if (row.startsWith('|')) row = row.slice(1);
    if (row.endsWith('|')) row = row.slice(0, -1);
    return row.split('|').map((cell) => cell.trim());
}

/** Reads each column's alignment from the separator row. */
function tableAlign(separator: string): Align[] {
    return tableCells(separator).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
    });
}

/** Splits the answer into blocks, line by line. */
export function parseBlocks(text: string): Block[] {
    const lines = text.split('\n');
    const blocks: Block[] = [];
    let paragraph: string[] = [];

    const flushParagraph = () => {
        if (paragraph.length > 0) {
            blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
            paragraph = [];
        }
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        // A fence runs to the closing fence, or — while an answer is still
        // streaming — to the end of what has arrived so far. Rendering the
        // partial block is what stops a code answer flickering in as prose and
        // then rearranging itself once the closing fence lands.
        const fence = /^```(\w*)\s*$/.exec(line);
        if (fence) {
            flushParagraph();
            const code: string[] = [];
            index += 1;
            while (index < lines.length && !/^```/.test(lines[index])) {
                code.push(lines[index]);
                index += 1;
            }
            blocks.push({
                kind: 'code',
                language: fence[1],
                code: code.join('\n')
            });
            continue;
        }

        // A table is a header row followed by a separator row. Checked before
        // the paragraph fallback, because that fallback joins lines with a
        // space — which is exactly how a table used to collapse into one
        // unreadable run-on line.
        if (
            line.includes('|') &&
            index + 1 < lines.length &&
            TABLE_SEPARATOR.test(lines[index + 1])
        ) {
            flushParagraph();
            const header = tableCells(line);
            const align = tableAlign(lines[index + 1]);
            index += 2;

            const rows: string[][] = [];
            while (index < lines.length && lines[index].includes('|')) {
                const cells = tableCells(lines[index]);
                // Pad or trim to the header's width so a ragged row (or a
                // half-streamed one) can't shift every cell after it.
                rows.push(
                    Array.from(
                        { length: header.length },
                        (_, column) => cells[column] ?? ''
                    )
                );
                index += 1;
            }
            index -= 1;

            blocks.push({ kind: 'table', header, align, rows });
            continue;
        }

        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        if (heading) {
            flushParagraph();
            blocks.push({
                kind: 'heading',
                level: heading[1].length,
                text: heading[2]
            });
            continue;
        }

        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        const listItem = bullet ?? numbered;
        if (listItem) {
            flushParagraph();
            const ordered = !bullet;
            const items: string[] = [listItem[1]];
            while (index + 1 < lines.length) {
                const next = lines[index + 1];
                const nextItem = ordered
                    ? /^\s*\d+[.)]\s+(.*)$/.exec(next)
                    : /^\s*[-*]\s+(.*)$/.exec(next);
                if (!nextItem) break;
                items.push(nextItem[1]);
                index += 1;
            }
            blocks.push({ kind: 'list', ordered, items });
            continue;
        }

        if (line.trim() === '') {
            flushParagraph();
            continue;
        }
        paragraph.push(line);
    }

    flushParagraph();
    return blocks;
}
