import { apiClient, toApiError } from '@orthacms/utils-admin';
import type {
    ApplyAccepted,
    ApplyOperation,
    SchemaDocumentEnvelope,
    SchemaPlan
} from '@orthacms/schema-builder-domain';
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
 * this package. No mapper: the contracts are the domain package's own,
 * shared with the server, so the wire shape and the view shape are one type.
 */
export const httpSchemaGateway: SchemaGateway = {
    document: () =>
        call(apiClient.get<SchemaDocumentEnvelope>('/schema-builder/document')),
    plan: (document, baseFingerprint) =>
        call(
            apiClient.post<SchemaPlan>('/schema-builder/plan', {
                document,
                baseFingerprint
            })
        ),
    apply: (input) =>
        call(apiClient.post<ApplyAccepted>('/schema-builder/apply', input)),
    operation: (id) =>
        call(apiClient.get<ApplyOperation>(`/schema-builder/operations/${id}`)),
    grant: async (workspaceId, slug) => {
        await call(
            apiClient.post(`/workspaces/${workspaceId}/content`, { slug })
        );
    }
};
