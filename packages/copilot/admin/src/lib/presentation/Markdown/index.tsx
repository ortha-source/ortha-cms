import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately small Markdown renderer for assistant answers.
 *
 * **Scope, stated honestly.** It handles what a CMS assistant actually emits —
 * paragraphs, ATX headings, fenced code blocks, unordered and ordered lists,
 * and the inline run of `**bold**`, `*italic*`, `` `code` `` and `[links](url)`.
 * It is not a CommonMark implementation and does not try to be: no tables, no
 * block quotes, no nested lists, no reference links. Unmatched syntax renders
 * as the literal characters the model wrote, which is the right failure — a
 * user sees slightly noisy text rather than a silently swallowed sentence.
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

/** One top-level block of the answer. */
type Block =
    | { kind: 'paragraph'; text: string }
    | { kind: 'heading'; level: number; text: string }
    | { kind: 'code'; language: string; code: string }
    | { kind: 'list'; ordered: boolean; items: string[] };

/** Splits the answer into blocks, line by line. */
function parseBlocks(text: string): Block[] {
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
        if (bullet || numbered) {
            flushParagraph();
            const ordered = !bullet;
            const items: string[] = [(bullet ?? numbered)![1]];
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
