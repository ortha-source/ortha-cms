/**
 * The **callout** node — a tinted, bordered aside that wraps one or more
 * blocks ("Note", "Warning", …). TipTap ships no such node, so it is defined
 * here.
 *
 * It serializes to semantic HTML the *consuming site* can style on its own:
 * `<aside data-callout data-tone="warning">…</aside>`. No admin class names go
 * into the stored content — the look comes from this plugin's stylesheet, which
 * targets the same data attributes.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { CALLOUT_TONE, type CalloutTone } from '../../../domain/constants';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        callout: {
            /**
             * Wrap the selection in a callout, or re-tone the callout it is
             * already inside. Re-toning rather than nesting is deliberate: a
             * callout inside a callout is never what the author meant by
             * picking a second tone.
             */
            setCallout: (tone: CalloutTone) => ReturnType;
            /** Unwrap the callout around the selection, keeping its blocks. */
            unsetCallout: () => ReturnType;
        };
    }
}

/** Options for {@link Callout}. */
export interface CalloutOptions {
    /** Attributes merged onto the rendered `<aside>`. */
    HTMLAttributes: Record<string, unknown>;
}

export const Callout = Node.create<CalloutOptions>({
    name: 'callout',

    group: 'block',

    // `block+`, not `inline*`: a callout holds paragraphs, lists, even a
    // nested table — it is a container, not a styled paragraph.
    content: 'block+',

    defining: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            tone: {
                default: CALLOUT_TONE.Info as CalloutTone,
                parseHTML: (element) =>
                    element.getAttribute('data-tone') ?? CALLOUT_TONE.Info,
                renderHTML: (attributes) => ({
                    'data-tone': attributes['tone']
                })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'aside[data-callout]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'aside',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-callout': ''
            }),
            0
        ];
    },

    addCommands() {
        return {
            setCallout:
                (tone) =>
                ({ commands, editor }) =>
                    editor.isActive(this.name)
                        ? commands.updateAttributes(this.name, { tone })
                        : commands.wrapIn(this.name, { tone }),
            unsetCallout:
                () =>
                ({ commands }) =>
                    commands.lift(this.name)
        };
    }
});
