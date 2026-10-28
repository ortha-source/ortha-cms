/** The OpenAPI document and the API reference it is served as. */
import type { ApiDocsOptions } from '@orthacms/bootstrap-server';
import { docsEnabled } from '@orthacms/config';

/** The OpenAPI document and the API reference it is served as. */
export function docsConfig(): ApiDocsOptions {
    return {
        // On outside production, where the reference is a development tool.
        // `API_DOCS=true` publishes it from a deployed instance.
        enabled: docsEnabled(),
        title: '__APP_TITLE__ API',
        version: '1.0.0'
    };
}
