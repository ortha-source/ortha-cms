import { apiClient, toApiError } from '@orthacms/utils-admin';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import type { SchemaGateway } from '../../domain/schemaGateway';

/** Unwraps the response and normalises every failure into an `ApiError`. */
async function call<T>(request: Promise<{ data: T }>): Promise<T> {
    try {
        return (await request).data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * HTTP implementation of {@link SchemaGateway} — the only `apiClient` use in
 * this package. The envelope needs no mapper: it is the domain package's own
 * contract, shared with the server, so the wire shape and the view shape are
 * one type.
 */
export const httpSchemaGateway: SchemaGateway = {
    document: () =>
        call(apiClient.get<SchemaDocumentEnvelope>('/schema-builder/document'))
};
