import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.heading.label',
        defaultMessage: 'Heading {level}'
    },
    placeholder: {
        id: 'wysiwyg.block.heading.placeholder',
        defaultMessage: 'Heading'
    }
});

/** Type/size per level. The editable keeps the real `h1`–`h6` element, so the
 *  document outline a screen reader announces matches the stored HTML. */
const LEVEL_CLASS: Record<number, string> = {
    1: 'text-3xl font-semibold tracking-tight mt-6 mb-1',
    2: 'text-2xl font-semibold tracking-tight mt-5 mb-1',
    3: 'text-xl font-semibold tracking-tight mt-4 mb-1',
    4: 'text-base font-semibold tracking-tight mt-3 mb-1',
    // 5 and 6 stop getting bigger and start getting quieter — six sizes in one
    // column would be indistinguishable, and that is how HTML's own defaults
    // read too.
    5: 'text-sm font-semibold tracking-tight mt-3 mb-1',
    6: 'text-muted-foreground text-sm font-semibold tracking-wide uppercase mt-3 mb-1'
};

/** The element for a level, as a tag `InlineEditable` can render. */
const LEVEL_TAG = {
    1: 'h1',
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6'
} as const;

/** A section heading, levels 1–6. */
export function HeadingBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const raw = Number(block.attrs['level']);
    const level = (raw >= 1 && raw <= 6 ? raw : 2) as 1 | 2 | 3 | 4 | 5 | 6;
    return (
        <InlineEditable
            as={LEVEL_TAG[level]}
            path={path}
            html={block.html}
            placeholder={intl.formatMessage(messages.placeholder)}
            ariaLabel={intl.formatMessage(messages.label, { level })}
            className={LEVEL_CLASS[level]}
        />
    );
}
