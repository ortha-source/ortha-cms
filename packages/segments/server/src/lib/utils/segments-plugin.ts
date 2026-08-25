import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { MAX_SEGMENT_TYPES } from '@orthacms/segments-domain';
import { SegmentsModule } from '../segments.module';
import type { SegmentsPluginConfig } from '../types/segments-config';

/** The segmentation plugin, carrying its config alongside the standard shape. */
export interface SegmentsServerPluginType extends ServerPlugin {
    /** The validated segmentation configuration. */
    segmentsConfig: SegmentsPluginConfig;
}

/**
 * Validates the config **eagerly**, the way `TransferPlugin` and `ContentPlugin`
 * do. A duplicate or malformed segment type key is a misconfiguration that would
 * otherwise surface as "this axis silently stopped constraining", months later
 * and nowhere near its cause.
 */
function assertConfig(config: SegmentsPluginConfig): void {
    const declared = config.types ?? [];
    if (declared.length > MAX_SEGMENT_TYPES) {
        throw new Error(
            `SegmentsPlugin: ${declared.length} segment types declared, but only ${MAX_SEGMENT_TYPES} projection slots exist. ` +
                'Add the next batch of slots by migration before declaring more.'
        );
    }
    const seen = new Set<string>();
    for (const type of declared) {
        if (!type.key || !/^[a-z][a-z0-9_-]*$/.test(type.key)) {
            throw new Error(
                `SegmentsPlugin: segment type key "${type.key}" is not a valid tag namespace. ` +
                    'Use lowercase letters, digits, hyphens and underscores, starting with a letter.'
            );
        }
        if (type.key.includes(':')) {
            // The colon separates a namespace from a value inside a tag, so a
            // key containing one could never be matched back out of `org:acme`.
            throw new Error(
                `SegmentsPlugin: segment type key "${type.key}" may not contain ":".`
            );
        }
        if (seen.has(type.key)) {
            throw new Error(
                `SegmentsPlugin: segment type key "${type.key}" is declared twice.`
            );
        }
        seen.add(type.key);
        if (!type.label?.trim()) {
            throw new Error(
                `SegmentsPlugin: segment type "${type.key}" has no label.`
            );
        }
    }
}

/**
 * Creates the segmentation plugin — reader entitlements over published content.
 *
 * Register it **after** `ContentPlugin`, whose `CONTENT_READ_SCOPE` port it
 * binds. Without a resolver every reader is anonymous, which serves unrestricted
 * content and nothing else; that is the honest default, since the CMS does not
 * own subscriptions or org charts.
 *
 * Owns six tables and ships its own migrations. Enabling the plugin changes no
 * behaviour on its own: with no segment type declared or created, the read
 * predicate is not emitted at all.
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity),
 *     ContentPlugin({ types: contentTypes }),
 *     SegmentsPlugin({
 *       types: [{ key: 'plan', label: 'Plan' }],
 *       resolver: claimsSegmentResolver({ … })
 *     })
 *   ]
 * });
 * ```
 */
export function SegmentsPlugin(
    config: SegmentsPluginConfig = {}
): SegmentsServerPluginType {
    assertConfig(config);
    return {
        name: 'segments',
        module: SegmentsModule.forRoot(config),
        segmentsConfig: config,
        migrations: {
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_segments'
        }
    };
}
