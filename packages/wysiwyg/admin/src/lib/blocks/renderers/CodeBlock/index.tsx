import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { decodeBasicEntities, escapeHtmlText } from '@ortha-cms/wysiwyg-core';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.code.label',
        defaultMessage: 'Code'
    },
    placeholder: {
        id: 'wysiwyg.block.code.placeholder',
        defaultMessage: 'Paste or write code…'
    },
    language: {
        id: 'wysiwyg.block.code.language',
        defaultMessage: 'Language'
    },
    plain: {
        id: 'wysiwyg.block.code.plain',
        defaultMessage: 'Plain text'
    }
});

/** Languages offered in the picker. The value is the `language-*` class. */
const LANGUAGES = [
    'bash',
    'css',
    'html',
    'json',
    'javascript',
    'typescript',
    'python',
    'sql',
    'yaml'
] as const;

/** The `SelectItem` value standing for "no language". Radix rejects `''`. */
const PLAIN = 'plain';

/**
 * A code block. Unlike every other text block this is a **`<textarea>`**, not a
 * `contenteditable`: code is plain text, and a contenteditable would let a
 * browser insert markup into it (a `<div>` per line, a smart quote, a pasted
 * `<b>`) — which the author would then see as code they did not write.
 * Its content is stored escaped, so the serialized `<pre><code>` is literal.
 */
export function CodeBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const ref = useRef<HTMLTextAreaElement>(null);
    const text = decodeBasicEntities(block.html);
    const language = String(block.attrs['language'] ?? '');

    // Grow to fit: a code block that scrolls inside itself hides the code.
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    }, [text]);

    return (
        <div className="bg-muted/60 border-border my-1 overflow-hidden rounded-md border">
            <div className="border-border/60 flex items-center justify-between border-b px-2 py-1">
                <Select
                    value={language || PLAIN}
                    disabled={readOnly}
                    onValueChange={(next) =>
                        commands.setAttrs(path, {
                            language: next === PLAIN ? '' : next
                        })
                    }
                >
                    <SelectTrigger
                        aria-label={intl.formatMessage(messages.language)}
                        className="h-7 w-40 border-none bg-transparent text-xs shadow-none"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={PLAIN}>
                            {intl.formatMessage(messages.plain)}
                        </SelectItem>
                        {LANGUAGES.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <textarea
                ref={ref}
                value={text}
                readOnly={readOnly}
                spellCheck={false}
                rows={1}
                aria-label={intl.formatMessage(messages.label)}
                placeholder={intl.formatMessage(messages.placeholder)}
                className="w-full resize-none bg-transparent px-3 py-2 font-mono text-sm leading-6 outline-none"
                onChange={(event) =>
                    commands.setHtml(path, escapeHtmlText(event.target.value))
                }
            />
        </div>
    );
}
