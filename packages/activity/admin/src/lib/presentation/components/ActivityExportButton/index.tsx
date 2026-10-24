import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner, toast } from '@orthacms/design-system';
import { useExportActivity } from '../../../application/useExportActivity';
import type { ActivityExportParams } from '../../../infrastructure/activityGateway';

/** Intl descriptors for {@link ActivityExportButton}, co-located. */
const messages = defineMessages({
    label: { id: 'activity.export.label', defaultMessage: 'Export CSV' },
    busy: { id: 'activity.export.busy', defaultMessage: 'Exporting…' },
    done: {
        id: 'activity.export.done',
        defaultMessage:
            '{count, plural, one {Exported # event.} other {Exported # events.}}'
    },
    truncated: {
        id: 'activity.export.truncated',
        defaultMessage:
            'Exported the newest {count, number} of {total, number} events. Narrow the range or the filters to export the rest.'
    },
    failed: {
        id: 'activity.export.failed',
        defaultMessage: 'Couldn’t export the activity log. Please try again.'
    }
});

/** Hands a blob to the browser as a download, and lets go of it. */
function saveFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        // Revoked at once: a live object URL holds the whole file in memory
        // for the life of the tab.
        URL.revokeObjectURL(url);
    }
}

/** Rows in a CSV body, header excluded — what the "Exported N" toast counts. */
async function rowsIn(blob: Blob): Promise<number> {
    const text = await blob.text();
    return Math.max(0, text.split('\r\n').filter(Boolean).length - 1);
}

/**
 * "Export CSV" in the page's top bar: the **current view** — the same search,
 * range and filters the feed shows, without its paging — as a file.
 *
 * The toast is the announcement, and it says when the file is not the whole
 * answer: the server caps an export, and an auditor handed a truncated file
 * must be told so rather than find out later. `aria-disabled` while busy (not
 * `disabled`), so a keyboard user does not lose their place.
 */
export function ActivityExportButton({
    params
}: {
    params: ActivityExportParams;
}) {
    const intl = useIntl();
    const exporter = useExportActivity();
    const busy = exporter.isPending;

    const run = () => {
        if (busy) return;
        exporter.mutate(params, {
            onSuccess: async (file) => {
                saveFile(file.blob, file.fileName);
                if (file.truncated) {
                    toast.warning(
                        intl.formatMessage(messages.truncated, {
                            count: await rowsIn(file.blob),
                            total: file.total
                        })
                    );
                    return;
                }
                toast.success(
                    intl.formatMessage(messages.done, { count: file.total })
                );
            },
            onError: () => {
                toast.error(intl.formatMessage(messages.failed));
            }
        });
    };

    return (
        <Button
            type="button"
            variant="outline"
            className="shadow-none"
            aria-disabled={busy || undefined}
            onClick={run}
        >
            {busy ? (
                <>
                    <Spinner aria-hidden className="size-4" />
                    <span className="sr-only">
                        {intl.formatMessage(messages.busy)}
                    </span>
                </>
            ) : null}
            {intl.formatMessage(messages.label)}
        </Button>
    );
}
