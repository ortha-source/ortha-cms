import { Fragment, type ReactNode } from 'react';
import { parseBlocks, type Block } from './parseBlocks';

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
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                    <code>{block.code}</code>
                </pre>
            );
        case 'table':
            return (
                // The panel is narrow and a content-type table is wide, so the
                // table scrolls inside its own container rather than making the
                // whole transcript scroll sideways.
                <div className="border-border overflow-x-auto rounded-md border">
                    <table className="w-full border-collapse text-xs">
                        {/* A tinted header and a rule beneath it, matching the
                            design system's own `Table`. Type is `text-xs` but
                            full-strength `text-foreground`, not muted: this is
                            data the user asked for, and small text is exactly
                            where a dimmed colour stops being readable. */}
                        <thead className="bg-muted/50">
                            <tr className="border-border border-b">
                                {block.header.map((cell, index) => (
                                    <th
                                        key={index}
                                        className="px-2.5 py-1.5 font-semibold whitespace-nowrap"
                                        style={{
                                            textAlign:
                                                block.align[index] ?? 'left'
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
                                                textAlign:
                                                    block.align[index] ?? 'left'
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

/** Matches the inline forms, longest-delimiter first so `**` beats `*`. */
const INLINE = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

/** Inline emphasis, code and links, as React nodes. */
function renderInline(text: string): ReactNode[] {
    return text.split(INLINE).map((token, index) => {
        if (!token) {
            return null;
        }

        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        if (link) {
            const href = safeHref(link[2]);
            // A rejected scheme still shows its label — dropping the text
            // would silently delete part of the answer.
            return href ? (
                <a
                    key={index}
                    href={href}
                    className="underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {link[1]}
                </a>
            ) : (
                <Fragment key={index}>{link[1]}</Fragment>
            );
        }
        if (token.startsWith('**') && token.endsWith('**')) {
            return (
                <strong key={index} className="font-semibold">
                    {token.slice(2, -2)}
                </strong>
            );
        }
        if (token.startsWith('`') && token.endsWith('`')) {
            return (
                <code
                    key={index}
                    className="bg-muted rounded px-1 py-0.5 text-xs"
                >
                    {token.slice(1, -1)}
                </code>
            );
        }
        if (token.startsWith('*') && token.endsWith('*')) {
            return <em key={index}>{token.slice(1, -1)}</em>;
        }
        return <Fragment key={index}>{token}</Fragment>;
    });
}

/**
 * A link target, or `null` if its scheme isn't safe to navigate to.
 *
 * Escaping protects text but not URLs: `[click](javascript:…)` is well-formed
 * Markdown, and the model's answer is derived from content an attacker may
 * have authored. Allow-list rather than deny-list — `javascript:` has enough
 * encodings to make blocking it by pattern a losing game.
 */
function safeHref(href: string): string | null {
    const trimmed = href.trim();
    return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : null;
}
