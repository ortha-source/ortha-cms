/**
 * The protection plugin's pass over the host's OpenAPI document.
 *
 * The controller is an ordinary decorated class, so the scanner already has the
 * paths, the parameters and the request body — `SaveProtectionRuleDto` carries
 * `@ApiPropertyOptional` on every field. What it cannot have is the response
 * shape: `ProtectionRuleView` is an `interface`, erased at compile time, so the
 * two reads arrive with a bare `200` and no content.
 *
 * Pure: takes the document and mutates only the paths this plugin serves.
 *
 * A local `openapi-writer` copy rather than an import from `segments` or
 * `alarms`, for the reason segments' own copy gives: it is a dozen lines, and
 * sharing it would turn one plugin's documentation helper into public API
 * another plugin's release has to keep compatible.
 */

import type { OpenApiDocument } from '@orthacms/bootstrap-server';
import {
    addErrorResponse,
    ref,
    setSuccessResponse,
    type Operation
} from './openapi-writer';
import {
    PROTECTION_RULE_SCHEMA,
    buildProtectionSchemas
} from './protection-schemas';

/** The routes this plugin serves, keyed by what follows `/protection`. */
const ROUTES = {
    '/rules': {
        get: {
            list: true,
            description:
                'Every rule the workspace holds, including any addressed at a content type it is no longer granted.'
        }
    },
    '/rules/{kind}/{slug}': {
        put: {
            list: false,
            description:
                'The stored rule. A replacement, not a patch: an omitted field took its default rather than its previous value.',
            notFound:
                'The workspace was not granted this content type — which is also the answer for a type that does not exist, so this tab cannot be used to enumerate the content model.'
        }
    }
} as const;

/** Writes this plugin's response shapes onto `document`. */
export function describeProtectionApi(document: OpenApiDocument): void {
    const components = (document.components ??= {});
    const schemas = (components.schemas ??= {});
    Object.assign(schemas, buildProtectionSchemas());

    for (const [suffix, methods] of Object.entries(ROUTES)) {
        const path = document.paths[`/api/protection${suffix}`];
        if (!path) continue;

        for (const [method, spec] of Object.entries(methods)) {
            const operation = path[method] as Operation | undefined;
            if (!operation) continue;

            setSuccessResponse(
                operation,
                spec.list
                    ? { type: 'array', items: ref(PROTECTION_RULE_SCHEMA) }
                    : ref(PROTECTION_RULE_SCHEMA),
                spec.description
            );
            if ('notFound' in spec && spec.notFound) {
                addErrorResponse(operation, '404', spec.notFound);
            }
        }
    }

    // `DELETE /rules/{kind}/{slug}` answers `204`, so it gets no body — the
    // writer would refuse one anyway. It does get its idempotency documented,
    // because "204 whether or not a rule was there" is the surprising half.
    const del = (
        document.paths['/api/protection/rules/{kind}/{slug}'] as
            | Record<string, Operation>
            | undefined
    )?.delete;
    if (del) {
        addErrorResponse(
            del,
            '204',
            'The type is unprotected. Answered whether or not a rule was there, and without requiring the type to still be granted.'
        );
    }
}
