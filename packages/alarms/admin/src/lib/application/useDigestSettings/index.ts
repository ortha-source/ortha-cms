import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alarmsKeys } from '../../infrastructure/alarmsKeys';
import { httpAlarmsGateway } from '../../infrastructure/httpAlarmsGateway';
import type { DigestFrequency } from '../../types/alarm';

/**
 * The reader's own alarm digest frequency. Per person, not per workspace —
 * one digest covers every workspace they belong to — so the key carries no
 * workspace id.
 */
export function useDigestSettings(enabled = true) {
    return useQuery({
        queryKey: alarmsKeys.digestSettings(),
        queryFn: () => httpAlarmsGateway.digestSettings(),
        enabled,
        // One retry, not three: a settings form waiting ~7s to say it could
        // not load reads as a hang.
        retry: 1
    });
}

/** Saves the frequency and places the answer, which is the whole resource. */
export function useSaveDigestSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (frequency: DigestFrequency) =>
            httpAlarmsGateway.saveDigestSettings(frequency),
        onSuccess: (settings) => {
            queryClient.setQueryData(alarmsKeys.digestSettings(), settings);
        }
    });
}
