import { Children, useId, useState, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, X } from 'lucide-react';
import { Card, Input, cn } from '@orthacms/design-system';
import { parseReaderTags, testReader } from '../../../domain/readerTest';

const messages = defineMessages({
    kicker: { id: 'segments.tester.kicker', defaultMessage: 'Try a reader' },
    inputHint: {
        id: 'segments.tester.inputHint',
        defaultMessage:
            'Type the tags a reader arrives with, separated by commas.'
    },
    inAudience: {
        id: 'segments.tester.in',
        defaultMessage: 'In <b>{name}</b>'
    },
    notInAudience: {
        id: 'segments.tester.notIn',
        defaultMessage: 'Not in <b>{name}</b>'
    },
    nearMiss: {
        id: 'segments.tester.nearMiss',
        defaultMessage:
            'Tags match exactly — “{tag}” is not the same tag in another case.'
    },
    explain: {
        id: 'segments.tester.explain',
        defaultMessage: 'Readers with {tags} see entries restricted to {name}.'
    },
    noTags: {
        id: 'segments.tester.noTags',
        defaultMessage:
            'Add a reader tag, or a key, and readers carrying it will be in this audience.'
    },
    unnamed: {
        id: 'segments.tester.unnamed',
        defaultMessage: 'this audience'
    }
});

type ReaderTesterProps = {
    /** The audience's name as typed so far. */
    name: string;
    /** The tags it answers to — its own, or its key when it has none. */
    tags: readonly string[];
};

/**
 * "Try a reader" — would somebody arriving with these tags be in the audience?
 *
 * Answered by the kernel's own matcher (`segmentIdsForTags`, through
 * `testReader`), so it cannot disagree with what the server does when that
 * reader arrives. It reads the form **as typed**, before anything is saved:
 * the question it exists for is "is this the audience I mean?", and that is
 * asked while it is still being written.
 *
 * Matching is exact, so a near miss that only differs in case is called out —
 * `Acme` matching nobody is the mistake this catches most often.
 *
 * The verdict is a polite live region: it changes as somebody types, and a
 * screen reader should hear the last answer, not every keystroke's.
 */
export function ReaderTester({ name, tags }: ReaderTesterProps) {
    const intl = useIntl();
    const id = useId();
    const [input, setInput] = useState('');
    const readerTags = parseReaderTags(input);
    const result = readerTags.length ? testReader(tags, readerTags) : null;
    const audience = name.trim() || intl.formatMessage(messages.unnamed);
    const bold = (chunks: ReactNode[]) => (
        <b className="font-semibold">{chunks}</b>
    );

    return (
        <Card className="flex flex-col gap-2.5 p-4 shadow-none">
            <label
                htmlFor={`${id}-input`}
                className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
                {intl.formatMessage(messages.kicker)}
            </label>
            <Input
                id={`${id}-input`}
                value={input}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder={tags[0] ?? 'acme'}
                aria-describedby={`${id}-hint`}
                onChange={(event) => setInput(event.target.value)}
            />
            <span id={`${id}-hint`} className="sr-only">
                {intl.formatMessage(messages.inputHint)}
            </span>

            <div role="status" aria-live="polite">
                {result ? (
                    <div
                        className={cn(
                            'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm',
                            result.inAudience
                                ? 'border-info/30 bg-info-soft text-info-soft-foreground'
                                : 'bg-muted/50 text-foreground'
                        )}
                    >
                        {result.inAudience ? (
                            <Check
                                className="mt-0.5 size-4 shrink-0 text-info"
                                aria-hidden
                            />
                        ) : (
                            <X
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                        )}
                        <span className="flex flex-col gap-1">
                            <span>
                                {Children.toArray(
                                    intl.formatMessage(
                                        result.inAudience
                                            ? messages.inAudience
                                            : messages.notInAudience,
                                        { name: audience, b: bold }
                                    )
                                )}
                            </span>
                            {result.nearMiss ? (
                                <span className="text-xs text-muted-foreground">
                                    {intl.formatMessage(messages.nearMiss, {
                                        tag: result.nearMiss
                                    })}
                                </span>
                            ) : null}
                        </span>
                    </div>
                ) : null}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
                {tags.length
                    ? Children.toArray(
                          intl.formatMessage(messages.explain, {
                              name: audience,
                              tags: intl.formatList(
                                  tags.map((tag) => (
                                      <code
                                          key={tag}
                                          className="font-mono text-foreground"
                                      >
                                          {tag}
                                      </code>
                                  )),
                                  { type: 'disjunction' }
                              )
                          })
                      )
                    : intl.formatMessage(messages.noTags)}
            </p>
        </Card>
    );
}
