import { Fragment, type ReactNode } from 'react';
import { parseBlocks, type Block } from './parseBlocks';
import { renderInline } from './renderInline';
import { MarkdownTable } from './MarkdownTable';

/**
 * A deliberately small Markdown renderer for assistant answers.
 *
 * **Scope, stated honestly.** It handles what a CMS assistant actually emits —
 * paragraphs, ATX headings, fenced code blocks, unordered and ordered lists,
 * **pipe tables**, and the inline run of `**bold**`, `*italic*`, `` `code` ``
 * and `[links](url)`. It is not a CommonMark implementation and does not try to
 * be: no block quotes, no nested lists, no reference links. Unmatched syntax
 * renders as the literal characters the model wrote, which is the right
 * failure — a user sees slightly noisy text rather than a silently swallowed
 * sentence.
 *
 * Tables were the first gap real use hit, and hard: asked to list content
 * types, the model emits a pipe table, and without table support every row fell
 * through to the paragraph branch — which joins lines with a space, collapsing
 * the whole table into one unreadable run-on line. If a second gap like that
 * turns up, that is the signal to stop growing this and take `react-markdown`.
 *
 * **It builds React elements and never touches `dangerouslySetInnerHTML`.**
 * That is the load-bearing property: an answer is derived from content the
 * model read, and content is user-authored and attacker-influenceable
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §8), so
 * anything it echoes back must be escaped. Going through React's normal text
 * children makes that automatic rather than a thing to remember. Link `href`s
 * are additionally scheme-checked, since a URL is the one place where escaping
 * is not enough (`javascript:` is a valid string in a valid `[](…)`).
 *
 * Swapping in `react-markdown` later is a drop-in replacement for this
 * component; it was left out for now to avoid adding a dependency the phase
 * doesn't otherwise need.
 */
export function Markdown({ text }: { text: string }) {
    return (
        <div className="text-sm leading-relaxed [&>*+*]:mt-2">
            {parseBlocks(text).map((block, index) => (
                <Fragment key={index}>{renderBlock(block)}</Fragment>
            ))}
        </div>
    );
}

function renderBlock(block: Block): ReactNode {
    switch (block.kind) {
        case 'heading': {
            const Tag = `h${Math.min(block.level + 2, 6)}` as 'h3';
            return (
                <Tag className="font-semibold">{renderInline(block.text)}</Tag>
            );
        }
        case 'code':
            return (
                // `tabIndex` because it scrolls: a scroll container a
                // keyboard-only user cannot move is code they can only read
                // half of (2.1.1).
                <pre
                    tabIndex={0}
                    className="bg-muted focus-visible:ring-ring overflow-x-auto rounded-md p-3 text-xs focus-visible:ring-2 focus-visible:outline-none"
                >
                    <code>{block.code}</code>
                </pre>
            );
        case 'table':
            return <MarkdownTable block={block} />;
        case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
                <Tag
                    className={
                        block.ordered
                            ? 'list-decimal space-y-1 pl-5'
                            : 'list-disc space-y-1 pl-5'
                    }
                >
                    {block.items.map((item, index) => (
                        <li key={index}>{renderInline(item)}</li>
                    ))}
                </Tag>
            );
        }
        case 'paragraph':
        default:
            return <p>{renderInline(block.text)}</p>;
    }
}
