import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Spinner
} from '@ortha-cms/design-system';
import type { ChatToolStep } from '../../domain/types/chat';
import { humanizeToolName, toolPhrase } from './labels';

const messages = defineMessages({
    // Fallbacks for a tool with no phrase of its own — an MCP connector's, or
    // one added without touching `labels.ts`. The name is interpolated rather
    // than left bare so the line still reads as a sentence.
    runningOther: {
        id: 'copilot.step.runningOther',
        defaultMessage: '{tool}…'
    },
    doneOther: {
        id: 'copilot.step.doneOther',
        defaultMessage: '{tool}'
    },
    toolName: {
        id: 'copilot.step.toolName',
        defaultMessage: 'Tool'
    },
    failed: {
        id: 'copilot.step.failed',
        defaultMessage: 'Failed'
    },
    input: {
        id: 'copilot.step.input',
        defaultMessage: 'Input'
    },
    output: {
        id: 'copilot.step.output',
        defaultMessage: 'Output'
    },
    duration: {
        id: 'copilot.step.duration',
        defaultMessage: '{ms}ms'
    }
});

/**
 * One tool call, collapsed to a single line and expandable to the exact input
 * and output — "no invisible actions"
 * ([`docs/design/copilot.md`](../../../../../../docs/design/copilot.md) §2).
 *
 * The step appears the moment the call is issued, before it has run, so a slow
 * or failing tool is visible rather than a gap in the answer.
 *
 * **It reads as a sentence in both tenses**: "Searching content…" while it runs,
 * "Searched content · 12 results" once it has. It used to show the raw
 * `admin_content_search` with a separate "Running…", which is a pending state
 * that technically existed and told nobody anything — for a tool that takes
 * 20ms it also flashes past, so what a user actually saw was a list of
 * snake_case function names. The identifier is still available, one click away
 * in the expanded panel, where someone debugging wants it and nobody else has
 * to read it.
 */
export function ToolStep({ step }: { step: ChatToolStep }) {
    const intl = useIntl();
    const running = step.status === 'running';
    const phrase = toolPhrase(step.name, running ? 'running' : 'done');
    const label = phrase
        ? intl.formatMessage(phrase)
        : intl.formatMessage(running ? messages.runningOther : messages.doneOther, {
              tool: humanizeToolName(step.name)
          });

    return (
        <Collapsible className="border-border/60 bg-muted/40 rounded-md border">
            <CollapsibleTrigger className="group flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs">
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                <StatusIcon status={step.status} />
                <span className="shrink-0">{label}</span>
                {/* The tool's own one-liner — "12 results", "applied" — after
                    the phrase rather than instead of it. A failed step says so
                    even when the tool returned no summary. */}
                {!running && (
                    <span className="text-muted-foreground truncate">
                        {step.summary ??
                            (step.status === 'error'
                                ? intl.formatMessage(messages.failed)
                                : '')}
                    </span>
                )}
                {step.durationMs !== undefined && (
                    <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                        {intl.formatMessage(messages.duration, {
                            ms: step.durationMs
                        })}
                    </span>
                )}
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-2 px-2.5 pb-2.5">
                <Payload
                    label={intl.formatMessage(messages.toolName)}
                    value={step.name}
                />
                <Payload
                    label={intl.formatMessage(messages.input)}
                    value={step.input}
                />
                {step.status === 'error' ? (
                    <Payload
                        label={intl.formatMessage(messages.failed)}
                        value={step.error}
                    />
                ) : (
                    step.output !== undefined && (
                        <Payload
                            label={intl.formatMessage(messages.output)}
                            value={step.output}
                        />
                    )
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

function StatusIcon({ status }: { status: ChatToolStep['status'] }) {
    if (status === 'running') {
        return <Spinner className="size-3.5 shrink-0" />;
    }
    if (status === 'error') {
        return <CircleAlert className="text-destructive size-3.5 shrink-0" />;
    }
    return <CircleCheck className="size-3.5 shrink-0 text-emerald-600" />;
}

/**
 * One labelled payload. Rendered as text in a `<pre>`, never as markup: a tool
 * result is content the workspace authored, and the expanded step is the one
 * place a user reads it raw.
 */
function Payload({ label, value }: { label: string; value: unknown }) {
    return (
        <div>
            <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                {label}
            </div>
            <pre className="bg-background max-h-56 overflow-auto rounded border p-2 text-[11px] leading-relaxed">
                {stringify(value)}
            </pre>
        </div>
    );
}

/** Pretty JSON, or the value itself when it is already a string. */
function stringify(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2) ?? '';
    } catch {
        return String(value);
    }
}
