import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@ortha-cms/design-system';
import {
    COLLECTION_PARAM,
    LOCALE_PARAM,
    RECORD_PARAM
} from '../../constants';
import { useRecordDraft } from '../../api/useRecordDraft';
import { RecordEditor } from '../../components/RecordEditor';

/**
 * Route page for the dynamic record editor
 * (`/records/:collection/:recordId?locale=en`). Loads the record draft (a
 * fixture today, the content API later) and renders the {@link RecordEditor},
 * remounted per collection/record/locale so its form state re-seeds cleanly on a
 * locale switch. The sidebar toggle and the delete action leave via history.
 */
export function RecordEditPage() {
    const params = useParams();
    const navigate = useNavigate();
    const [search, setSearch] = useSearchParams();

    const collection = params[COLLECTION_PARAM] ?? 'articles';
    const recordId = params[RECORD_PARAM] ?? '';
    const locale = search.get(LOCALE_PARAM) ?? 'en';

    const draftQuery = useRecordDraft(collection, recordId, locale);

    const onSwitchLocale = useCallback(
        (code: string) => {
            const next = new URLSearchParams(search);
            next.set(LOCALE_PARAM, code);
            setSearch(next);
        },
        [search, setSearch]
    );

    const onExit = useCallback(() => navigate(-1), [navigate]);

    if (draftQuery.isPending || !draftQuery.data) {
        return (
            <div className="flex h-svh items-center justify-center bg-muted">
                <Spinner aria-hidden />
            </div>
        );
    }

    return (
        <RecordEditor
            key={`${collection}:${recordId}:${draftQuery.data.locale}`}
            draft={draftQuery.data}
            onSwitchLocale={onSwitchLocale}
            onExit={onExit}
        />
    );
}
