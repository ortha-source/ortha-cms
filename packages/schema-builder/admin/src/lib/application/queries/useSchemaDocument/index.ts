import { useQuery } from '@tanstack/react-query';
import { httpSchemaGateway } from '../../../infrastructure/httpSchemaGateway';
import { schemaKeys } from '../../../infrastructure/schemaKeys';

/**
 * The content model the running server serves. `enabled` withholds the
 * request until `content:read` is confirmed, so a page without access fires
 * nothing the server would 403. The app's default staleness applies: a person
 * editing a type file by hand restarts the server too, and coming back to the
 * tab should show it.
 */
export function useSchemaDocument(enabled = true) {
    return useQuery({
        queryKey: schemaKeys.document(),
        queryFn: () => httpSchemaGateway.document(),
        enabled
    });
}
