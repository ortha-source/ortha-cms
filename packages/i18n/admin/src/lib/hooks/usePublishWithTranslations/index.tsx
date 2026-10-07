import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    BulkPublishDialog,
    type RecordsBulkActionEntry,
    type RecordsBulkContext
} from '@orthacms/content-admin';
import { CONTENT_PUBLISH } from '../../constants';
import { entryLocalesPrefix } from '../../api/useEntryLocales';
import { localeSummariesPrefix } from '../../api/useLocaleSummaries';
import {
    PublishTranslationsDialog,
    type TranslationsPicked
} from '../../components/PublishTranslationsDialog';

const messages = defineMessages({
    action: {
        id: 'i18n.bulk.publishWithTranslations',
        defaultMessage: 'Publish with translations…'
    },
    title: {
        id: 'i18n.bulk.publishWithTranslationsTitle',
        defaultMessage:
            'Publish {count, plural, one {# entry} other {# entries}} across locales?'
    },
    body: {
        id: 'i18n.bulk.publishWithTranslationsBody',
        defaultMessage:
            'Each picked translation is checked below. Only the ones that pass will publish — the others stay as they are.'
    }
});

/**
 * **Publish with translations…** — the records selection bar's "deep" publish
 * for a localized type. The built-in Publish acts on the selected rows, which
 * are one locale of each record; this one lets the reader take each record's
 * other translations along, all of them or just some — per locale for every
 * record, or per record.
 *
 * Two steps, two dialogs: {@link PublishTranslationsDialog} picks the
 * (record, locale) pairs, then content's exported `BulkPublishDialog` dry-runs
 * and commits the picked entry ids, exactly as it does for "publish all
 * locales" in the editor. No publish endpoint of its own — translations are
 * entries of the same type, so every gate, guard and partial-success rule of a
 * plain bulk publish holds unchanged.
 *
 * Hidden unless the type is localized **and** publishable, the trash is not
 * open, and the user may publish. Clears the selection only once the publish
 * has gone through: the overlay unmounts with the selection bar.
 */
export function usePublishWithTranslations(
    context: RecordsBulkContext
): RecordsBulkActionEntry | null {
    const intl = useIntl();
    const queryClient = useQueryClient();
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [review, setReview] = useState<TranslationsPicked | null>(null);

    const { schema, workspaceId, ids, trashed, onDone } = context;
    const applies =
        !!schema.i18n && !!schema.publishable && !trashed && canPublish;
    if (!applies || ids.length === 0) return null;

    return {
        label: intl.formatMessage(messages.action),
        icon: Languages,
        onSelect: () => setPickerOpen(true),
        overlay: (
            <>
                <PublishTranslationsDialog
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    typeName={schema.name}
                    ids={ids}
                    onContinue={(picked) => {
                        setPickerOpen(false);
                        setReview(picked);
                    }}
                />
                <BulkPublishDialog
                    open={review !== null}
                    onOpenChange={(open) => {
                        if (!open) setReview(null);
                    }}
                    typeName={schema.name}
                    ids={review?.ids ?? []}
                    labels={{
                        title: intl.formatMessage(messages.title, {
                            count: review?.ids.length ?? 0
                        }),
                        body: intl.formatMessage(messages.body)
                    }}
                    labelFor={review?.labelFor}
                    onPublished={() => {
                        // Content refreshes its own caches; the Locales column
                        // and any open locale menu are this plugin's.
                        void queryClient.invalidateQueries({
                            queryKey: localeSummariesPrefix(
                                workspaceId,
                                schema.name
                            )
                        });
                        void queryClient.invalidateQueries({
                            queryKey: entryLocalesPrefix(
                                workspaceId,
                                schema.name
                            )
                        });
                        onDone();
                    }}
                />
            </>
        )
    };
}
