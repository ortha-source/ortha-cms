/**
 * The structural rules a rich-text body is checked against — the half of this
 * change that makes heading, table, link and language semantics *checkable*
 * rather than merely expressible.
 *
 * Every rule here is one both runtimes apply: the server refuses a body that
 * trips an **error** (it is the gate — nothing is written or published without
 * passing), and the admin editor shows the same list, warnings included, while
 * the author is still in a position to fix it. Section 508's 504.2 asks whether
 * an authoring tool *enables* the production of conformant content; a rule
 * nobody sees until a save fails does not, which is why the editor gets the
 * whole list and not just the blocking part.
 *
 * ### Errors and warnings
 *
 * An **error** is a fact about the document that is wrong however it is read:
 * a heading level that skips, a table whose cells no header governs, a link
 * with nothing to announce, a `lang` no user agent can parse. A **warning** is
 * a judgement — "click here" is poor link text, but it is not decidable from
 * the string that a body means it badly. Only errors fail validation, so the
 * kernel never blocks a save on a heuristic.
 *
 * A field can switch the enforcement off entirely with
 * `validation: { structure: 'off' }` — for a body that is genuinely not a
 * document (an email template, a hand-maintained fragment). It is deliberately
 * per-field and explicit: the default is to check.
 */

import { isWellFormedLanguageTag } from './language-tag';
import {
    RICH_TEXT_MARK,
    RICH_TEXT_NODE,
    langOf,
    walkRichText
} from './rich-text-node';
import type { RichTextMark, RichTextNode } from './rich-text-node';
import { asRichTextDocument, richTextDocumentText } from './rich-text-document';

/** What a structural finding is about — a stable key, for UI and for tests. */
export const RICH_TEXT_ISSUE = {
    /** A heading is more than one level below the heading before it (1.3.1). */
    HeadingLevelSkipped: 'headingLevelSkipped',
    /** A heading above the body's own top level — an inverted outline (1.3.1). */
    HeadingLevelInverted: 'headingLevelInverted',
    /** A heading with no text — a landmark that names nothing (2.4.6). */
    HeadingEmpty: 'headingEmpty',
    /** A table with neither header cells nor a caption (1.3.1). */
    TableMissingHeader: 'tableMissingHeader',
    /** A link whose text is empty (2.4.4). */
    LinkTextEmpty: 'linkTextEmpty',
    /** A link whose text says nothing about where it goes (2.4.4 / 2.4.6). */
    LinkTextNotDescriptive: 'linkTextNotDescriptive',
    /** A `lang` marker no user agent can parse (3.1.2). */
    InvalidLanguageTag: 'invalidLanguageTag'
} as const;

/** A structural finding's kind. */
export type RichTextIssueCode =
    (typeof RICH_TEXT_ISSUE)[keyof typeof RICH_TEXT_ISSUE];

/** Whether a finding blocks a save, or is advice for the author. */
export type RichTextIssueSeverity = 'error' | 'warning';

/** One structural finding on one document. */
export interface RichTextStructureIssue {
    /** Which rule it is — see {@link RICH_TEXT_ISSUE}. */
    code: RichTextIssueCode;
    /**
     * The finding as a sentence fragment, so it reads correctly after the
     * field's name (`body has a heading that skips from h2 to h4`) — the same
     * shape every other validation message here takes.
     */
    message: string;
    /** `error` fails validation; `warning` is surfaced to the author only. */
    severity: RichTextIssueSeverity;
    /** The success criterion it comes from, for the editor's explanation. */
    wcag: string;
}

/**
 * Link phrasings that describe the act of clicking rather than the
 * destination. Read out of context — which is how a screen reader's link list
 * presents them — every one of these is the same link.
 */
const NON_DESCRIPTIVE_LINK_TEXT: ReadonlySet<string> = new Set([
    'click here',
    'click',
    'here',
    'read more',
    'more',
    'learn more',
    'this',
    'this link',
    'link',
    'see more',
    'details',
    'go',
    'download',
    'continue'
]);

/** Whether a mark is a link. */
function isLink(mark: RichTextMark): boolean {
    return mark.type === RICH_TEXT_MARK.Link;
}

/**
 * The links in the tree, each with the text a reader is offered for it.
 *
 * A link is a **mark**, so it spans whatever inline content it was applied to:
 * one or more text runs, or an image, whose `alt` is then the only name the
 * link has. Adjacent inline nodes under the same href are one link to a
 * reader, even though a bold word or a colour splits them into two nodes —
 * and anything that is not inline ends the run, so two links in two paragraphs
 * are never read as one.
 */
function linkRuns(doc: RichTextNode): { href: string; text: string }[] {
    const runs: { href: string; text: string }[] = [];
    let open: { href: string; text: string } | null = null;
    for (const node of walkRichText(doc)) {
        const inline =
            node.type === RICH_TEXT_NODE.Text ||
            node.type === RICH_TEXT_NODE.Image;
        const mark = inline ? (node.marks ?? []).find(isLink) : undefined;
        if (!mark) {
            open = null;
            continue;
        }
        const href = String(mark.attrs?.['href'] ?? '');
        const text =
            node.type === RICH_TEXT_NODE.Text
                ? (node.text ?? '')
                : String(node.attrs?.['alt'] ?? '');
        if (open && open.href === href) open.text += text;
        else {
            open = { href, text };
            runs.push(open);
        }
    }
    return runs;
}

/** Whether link text is a bare URL — announced character by character. */
function isBareUrl(text: string): boolean {
    return /^(?:https?:\/\/|www\.)\S+$/i.test(text);
}

/** Every `lang` marker in the tree, node attributes and marks alike. */
function languageTags(doc: RichTextNode): string[] {
    const tags: string[] = [];
    for (const node of walkRichText(doc)) {
        const nodeLang = langOf(node);
        if (nodeLang !== undefined) tags.push(nodeLang);
        for (const mark of node.marks ?? []) {
            const markLang = langOf(mark);
            if (markLang !== undefined) tags.push(markLang);
        }
    }
    return tags;
}

/** The heading levels in the tree, in document order, with their text. */
function headings(doc: RichTextNode): { level: number; text: string }[] {
    const out: { level: number; text: string }[] = [];
    for (const node of walkRichText(doc)) {
        if (node.type !== RICH_TEXT_NODE.Heading) continue;
        const level = Number(node.attrs?.['level']);
        out.push({
            level:
                Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1,
            text: richTextDocumentText(node).trim()
        });
    }
    return out;
}

/** A table's own cells — not those of a table nested inside one of them. */
function* ownCells(table: RichTextNode): Generator<RichTextNode> {
    for (const row of table.content ?? []) {
        if (row.type !== RICH_TEXT_NODE.TableRow) continue;
        for (const cell of row.content ?? []) yield cell;
    }
}

/**
 * Every structural finding in a rich-text **value** — a document, or a legacy
 * HTML string, which is read as one first (see {@link asRichTextDocument}) so
 * a body written before this change is checked by exactly the same rules.
 *
 * Grouped by rule — outline first, then tables, links and language markers —
 * and within a group in document order.
 */
export function inspectRichText(value: unknown): RichTextStructureIssue[] {
    const doc = asRichTextDocument(value);
    const issues: RichTextStructureIssue[] = [];
    const add = (
        code: RichTextIssueCode,
        message: string,
        severity: RichTextIssueSeverity,
        wcag: string
    ) => issues.push({ code, message, severity, wcag });

    // Headings — the document's outline. A reader who navigates by heading
    // gets the structure the levels describe, so a level that jumps invents a
    // section that isn't there, and one that rises above the body's own top
    // level puts a subsection over the thing it belongs to.
    const outline = headings(doc);
    let previous: number | null = null;
    const top = outline.length ? outline[0].level : null;
    for (const heading of outline) {
        if (heading.text === '')
            add(
                RICH_TEXT_ISSUE.HeadingEmpty,
                `has an empty h${heading.level} heading`,
                'error',
                '2.4.6'
            );
        if (previous !== null && heading.level > previous + 1)
            add(
                RICH_TEXT_ISSUE.HeadingLevelSkipped,
                `has a heading that skips from h${previous} to h${heading.level}`,
                'error',
                '1.3.1'
            );
        if (top !== null && heading.level < top)
            add(
                RICH_TEXT_ISSUE.HeadingLevelInverted,
                `has an h${heading.level} heading below an h${top} — the outline starts at h${top}`,
                'warning',
                '1.3.1'
            );
        previous = heading.level;
    }

    // Tables — without a header row (or, failing that, a caption) a screen
    // reader has nothing to announce a cell against, and the grid is a list of
    // unlabelled values.
    for (const node of walkRichText(doc)) {
        if (node.type !== RICH_TEXT_NODE.Table) continue;
        const cells = [...ownCells(node)];
        const hasHeader = cells.some(
            (cell) => cell.type === RICH_TEXT_NODE.TableHeader
        );
        const hasCaption = (node.content ?? []).some(
            (child) => child.type === RICH_TEXT_NODE.TableCaption
        );
        if (cells.length && !hasHeader && !hasCaption)
            add(
                RICH_TEXT_ISSUE.TableMissingHeader,
                'has a table with no header cells',
                'error',
                '1.3.1'
            );
    }

    // Links — read out of their sentence in a screen reader's link list, so
    // the text has to carry the destination on its own.
    for (const run of linkRuns(doc)) {
        const text = run.text.trim();
        if (text === '') {
            add(
                RICH_TEXT_ISSUE.LinkTextEmpty,
                `has a link with no text (${run.href || 'no address'})`,
                'error',
                '2.4.4'
            );
            continue;
        }
        if (
            NON_DESCRIPTIVE_LINK_TEXT.has(
                text
                    .toLowerCase()
                    .replace(/[.!?…»)\]]+$/, '')
                    .trim()
            ) ||
            isBareUrl(text)
        )
            add(
                RICH_TEXT_ISSUE.LinkTextNotDescriptive,
                `has a link whose text ("${text}") does not say where it goes`,
                'warning',
                '2.4.4'
            );
    }

    // Language of parts — a marker a user agent cannot parse is not a marker.
    for (const tag of languageTags(doc)) {
        if (!isWellFormedLanguageTag(tag))
            add(
                RICH_TEXT_ISSUE.InvalidLanguageTag,
                `has an invalid language tag ("${tag}")`,
                'error',
                '3.1.2'
            );
    }

    return issues;
}
