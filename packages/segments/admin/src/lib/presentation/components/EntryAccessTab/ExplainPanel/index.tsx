import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Play, X } from 'lucide-react';
import {
    Badge,
    Button,
    Field,
    FieldDescription,
    FieldLabel,
    Spinner,
    Textarea,
    cn
} from '@orthacms/design-system';
import { useExplainAccess } from '../../../../application/useExplainAccess';

const messages = defineMessages({
    heading: {
        id: 'segments.explain.heading',
        defaultMessage: 'Try it as a reader'
    },
    body: {
        id: 'segments.explain.body',
        defaultMessage:
            'Runs the real decision against the tags you paste, and reports every check in the order it was made. Not a description of what the rule ought to do — the same function a request goes through.'
    },
    tags: { id: 'segments.explain.tags', defaultMessage: 'Reader tags' },
    tagsHint: {
        id: 'segments.explain.tagsHint',
        defaultMessage:
            'One per line, as your resolver would produce them (for example “org:acme”). Leave empty for an anonymous reader.'
    },
    run: { id: 'segments.explain.run', defaultMessage: 'Check' },
    visible: {
        id: 'segments.explain.visible',
        defaultMessage: 'This reader sees the entry'
    },
    hidden: {
        id: 'segments.explain.hidden',
        defaultMessage: 'This reader does not see the entry'
    },
    matched: {
        id: 'segments.explain.matched',
        defaultMessage: 'Let in by group {group}'
    },
    served: {
        id: 'segments.explain.served',
        defaultMessage: 'They are served: {fallback}'
    },
    resolved: {
        id: 'segments.explain.resolved',
        defaultMessage: 'Their tags resolved to'
    },
    noSegments: {
        id: 'segments.explain.noSegments',
        defaultMessage: 'no segment at all'
    },
    error: {
        id: 'segments.explain.error',
        defaultMessage: 'Couldn’t run the check. Please try again.'
    }
});

/** Props for {@link ExplainPanel}. */
type ExplainPanelProps = {
    /** The content type the entry belongs to. */
    typeSlug: string;
    /** The entry to ask about. */
    entryId: string;
};

/**
 * The simulator: paste a reader's tags, get the decision and every step of it.
 *
 * The steps are a **flat list** because the model is — exclusions, then the
 * window, then the groups, OR-ed. That flatness is the whole return on refusing
 * an expression language: an arbitrary boolean tree would have to be explained
 * as a proof, and nobody reads a proof to find out why their article is hidden.
 *
 * A textarea rather than a tag input, for the same reason the segment editor
 * uses one: the tags come out of another system, and the natural gesture is a
 * paste.
 */
export function ExplainPanel({ typeSlug, entryId }: ExplainPanelProps) {
    const intl = useIntl();
    const [tags, setTags] = useState('');
    const explain = useExplainAccess();
    const result = explain.data;

    return (
        <section className="rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="text-sm font-semibold">
                {intl.formatMessage(messages.heading)}
            </h3>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                {intl.formatMessage(messages.body)}
            </p>

            <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    explain.mutate({
                        typeSlug,
                        entryId,
                        tags: tags
                            .split('\n')
                            .map((tag) => tag.trim())
                            .filter(Boolean)
                    });
                }}
            >
                <Field>
                    <FieldLabel htmlFor="explain-tags">
                        {intl.formatMessage(messages.tags)}
                    </FieldLabel>
                    <Textarea
                        id="explain-tags"
                        rows={3}
                        value={tags}
                        placeholder="org:acme"
                        onChange={(event) => setTags(event.target.value)}
                    />
                    <FieldDescription>
                        {intl.formatMessage(messages.tagsHint)}
                    </FieldDescription>
                </Field>
                <div>
                    <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={explain.isPending}
                    >
                        {explain.isPending ? <Spinner /> : <Play aria-hidden />}
                        {intl.formatMessage(messages.run)}
                    </Button>
                </div>
            </form>

            {explain.isError ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                    {intl.formatMessage(messages.error)}
                </p>
            ) : null}

            {result ? (
                <div className="mt-4 flex flex-col gap-3" aria-live="polite">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant={
                                result.visible ? 'success' : 'destructive-soft'
                            }
                        >
                            {intl.formatMessage(
                                result.visible
                                    ? messages.visible
                                    : messages.hidden
                            )}
                        </Badge>
                        {result.visible && result.matchedGroup >= 0 ? (
                            <span className="text-xs text-muted-foreground">
                                {intl.formatMessage(messages.matched, {
                                    group: result.matchedGroup + 1
                                })}
                            </span>
                        ) : null}
                        {!result.visible && result.fallback ? (
                            <span className="text-xs text-muted-foreground">
                                {intl.formatMessage(messages.served, {
                                    fallback: result.fallback
                                })}
                            </span>
                        ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.resolved)}:{' '}
                        {Object.keys(result.readerSegments).length === 0
                            ? intl.formatMessage(messages.noSegments)
                            : Object.entries(result.readerSegments)
                                  .map(
                                      ([typeKey, labels]) =>
                                          `${typeKey}: ${labels.join(', ')}`
                                  )
                                  .join(' · ')}
                    </p>

                    <ol className="flex flex-col gap-1.5">
                        {result.steps.map((step, index) => (
                            <li
                                key={`${step.label}-${index}`}
                                className="flex items-start gap-2 text-sm"
                            >
                                {step.passed ? (
                                    <Check
                                        className="mt-0.5 size-4 shrink-0 text-success-soft-foreground"
                                        aria-hidden
                                    />
                                ) : (
                                    <X
                                        className="mt-0.5 size-4 shrink-0 text-destructive"
                                        aria-hidden
                                    />
                                )}
                                <span>
                                    <span
                                        className={cn(
                                            'font-medium',
                                            !step.passed && 'text-destructive'
                                        )}
                                    >
                                        {step.label}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {' — '}
                                        {step.detail}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            ) : null}
        </section>
    );
}
