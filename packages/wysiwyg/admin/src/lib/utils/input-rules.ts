/**
 * Markdown input rules — the shortcuts that turn `## ` into a heading and `- `
 * into a bullet as you type.
 *
 * A rule only fires when its trigger is the **whole** text before the caret, so
 * it can only ever convert a block the author has just started. Typing "1. two
 * things" mid-sentence, or a `>` inside a paragraph, is left alone.
 */

import { BLOCK_TYPE, type BlockAttrs } from '@ortha-cms/wysiwyg-core';

/** What a matched rule turns the block into. */
export interface InputRuleMatch {
    /** The block type to switch to. */
    readonly type: string;
    /** Attributes for the new type (a heading level, a checked to-do). */
    readonly attrs?: BlockAttrs;
    /** How many characters of trigger to delete from the block. */
    readonly consumed: number;
}

/** One rule: a pattern anchored to the block start, and what it produces. */
interface InputRule {
    readonly pattern: RegExp;
    readonly type: string;
    attrs?(match: RegExpExecArray): BlockAttrs;
}

const RULES: readonly InputRule[] = [
    {
        pattern: /^(#{1,6})\s$/,
        type: BLOCK_TYPE.Heading,
        attrs: (match) => ({ level: match[1].length })
    },
    { pattern: /^[-*+]\s$/, type: BLOCK_TYPE.BulletedList },
    { pattern: /^1[.)]\s$/, type: BLOCK_TYPE.NumberedList },
    {
        pattern: /^\[([ xX]?)\]\s$/,
        type: BLOCK_TYPE.Todo,
        attrs: (match) => ({ checked: match[1].toLowerCase() === 'x' })
    },
    { pattern: /^>\s$/, type: BLOCK_TYPE.Quote },
    { pattern: /^```$/, type: BLOCK_TYPE.Code },
    { pattern: /^(-{3}|\*{3}|_{3})$/, type: BLOCK_TYPE.Divider }
];

/**
 * The rule matching the text typed so far, or `null`. `text` is everything
 * between the start of the block and the caret.
 */
export function matchInputRule(text: string): InputRuleMatch | null {
    // A non-breaking space (\u00a0) is what a browser puts in a contenteditable when
    // you type a space at the end of a line; without this, every space-
    // terminated rule would fail exactly when it is meant to fire.
    const normalized = text.replace(/\u00a0/g, ' ');
    for (const rule of RULES) {
        const match = rule.pattern.exec(normalized);
        if (!match) continue;
        return {
            type: rule.type,
            attrs: rule.attrs?.(match),
            consumed: normalized.length
        };
    }
    return null;
}

/**
 * The slash-menu query in the text before the caret, or `null` when the menu
 * shouldn't be open. The `/` has to start a word — otherwise every URL typed
 * into a paragraph would open the block menu.
 */
export function matchSlashQuery(text: string): string | null {
    const match = /(?:^|[\s\u00a0])\/([\p{L}\p{N} ]{0,24})$/u.exec(text);
    return match ? match[1] : null;
}
