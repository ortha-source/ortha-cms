import { useMutation } from '@tanstack/react-query';
import { httpActivityGateway } from '../../infrastructure/httpActivityGateway';
import type { ActivityExportParams } from '../../infrastructure/activityGateway';
import type { ActivityExport } from '../../types/activityExport';

/**
 * Asks the server for the current view as a CSV file.
 *
 * A mutation rather than a query, though it changes nothing: it is fired by a
 * button, its answer is a one-off download rather than state to cache, and a
 * query would refetch an audit export on window focus. Invalidates nothing.
 *
 * Needs `activity:read` — the same key as the log — and the caller renders the
 * control only when the reader holds it.
 */
export function useExportActivity() {
    return useMutation<ActivityExport, Error, ActivityExportParams>({
        mutationFn: (params) => httpActivityGateway.exportCsv(params)
    });
}
