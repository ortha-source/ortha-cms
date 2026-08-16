import { Fragment, type ReactNode } from 'react';

/** Matches the inline forms, longest-delimiter first so `**` beats `*`. */
const INLINE = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

/** Inline emphasis, code and links, as React nodes. */
export function renderInline(text: string): ReactNode[] {
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
