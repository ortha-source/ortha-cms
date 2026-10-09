import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    STORAGE_PROVIDER,
    type PublicAssetUrls,
    type StorageProvider
} from '@orthacms/media-domain';
import { isInlineSafe } from '../../http/download-headers';

/**
 * Whether the API reports a provider's public URLs at all (ADR-0021).
 *
 * - `off` — every URL is the app's own authorized route. The default.
 * - `provider` — where the provider publishes an object, report that URL
 *   instead. The plugin refuses to boot this against a provider that declares
 *   no `publicUrls` capability.
 */
export type PublicUrlsMode = 'off' | 'provider';

/**
 * Which assets a public URL may be reported for, by stored MIME type.
 *
 * - `inline-safe` — only the types the download route itself serves inline
 *   (raster images, audio, video, PDF, plain text). The default: a CDN does not
 *   apply the app's `nosniff`, CSP and attachment disposition, so an uploaded
 *   `.html` or scripted `.svg` behind a public URL would execute on the CDN's
 *   origin.
 * - `all` — every type. For a CDN the operator has configured to set those
 *   headers itself.
 */
export type PublicUrlTypes = 'inline-safe' | 'all';

/** Resolved public-URL settings, bound at the composition root. */
export interface PublicUrlsConfig {
    mode: PublicUrlsMode;
    types: PublicUrlTypes;
}

/** DI token the module binds to the resolved {@link PublicUrlsConfig}. */
export const PUBLIC_URLS = Symbol('PUBLIC_URLS');

/** The derivatives the core generates, in the order a page asks for them. */
const DERIVATIVES = ['thumb', 'preview'] as const;

/** Content type of every generated derivative (`SharpImageProcessor`). */
const DERIVATIVE_MIME_TYPE = 'image/webp';

/** What the resolver needs to know about one asset — a slice of its row. */
export interface PublicUrlSubject {
    id: string;
    storageKey: string;
    mimeType: string;
    kind: string;
    /** The `variants` column: derivative name → its own storage key. */
    variants: Record<string, { key: string }> | null;
}

/**
 * The public URLs of one asset, as the core reports them. Present only for an
 * asset the deployment publishes, and then `url` always is.
 */
export interface AssetPublicUrls {
    /** The original. */
    url: string;
    /**
     * The `thumb` derivative's public URL, or else the provider's own poster
     * for the original (`PublicAssetUrls.thumbnailUrl`) — a video's, typically,
     * which has no derivative of its own.
     */
    thumbUrl?: string;
    /** The `preview` derivative's public URL. */
    previewUrl?: string;
    /** Streaming manifests, as the provider reported them. */
    streams?: { hls?: string; dash?: string };
}

/** True for an absolute `http:` / `https:` URL. */
export function isAbsoluteHttpUrl(value: unknown): value is string {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

/** True when the config lets an asset of this type be published. */
export function mayPublish(
    config: PublicUrlsConfig,
    mimeType: string
): boolean {
    if (config.mode !== 'provider') return false;
    return config.types === 'all' || isInlineSafe(mimeType);
}

/**
 * Reads a provider's **public URLs** for a page of assets — the one place the
 * core asks, so the switch, the MIME gate and the validation are applied once
 * for every surface that reports a URL (the library, the upload responses, the
 * content resolver and, through it, the public content API).
 *
 * With the switch off it returns an empty map **without calling the provider**,
 * which is what keeps every response identical to a deployment that never heard
 * of the feature.
 *
 * The decision is per **asset**: an original the MIME gate holds back gets no
 * public URL, and neither do its derivatives. A derivative the provider does
 * not publish falls back to the app's `?variant=` route on its own.
 */
@Injectable()
export class PublicAssetUrlsQuery {
    private readonly logger = new Logger(PublicAssetUrlsQuery.name);

    constructor(
        @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
        @Inject(PUBLIC_URLS) private readonly config: PublicUrlsConfig
    ) {}

    /** Whether this deployment reports public URLs at all. */
    get enabled(): boolean {
        return (
            this.config.mode === 'provider' &&
            this.provider.capabilities.publicUrls &&
            typeof this.provider.publicUrls === 'function'
        );
    }

    /**
     * Public URLs keyed by asset id. An asset absent from the map has none,
     * and every URL for it is the app's own route.
     *
     * Every provider call for the page — originals and derivatives alike — is
     * issued at once, so an async provider costs one round of latency per
     * page, never one per row.
     */
    async forAssets(
        subjects: readonly PublicUrlSubject[]
    ): Promise<Map<string, AssetPublicUrls>> {
        const result = new Map<string, AssetPublicUrls>();
        // Belt to the plugin's braces, like `directUrlFor`: the boot check
        // refuses a provider without the capability, so reaching here without
        // one means it was swapped underneath us — the app's route is the safe
        // answer.
        if (!this.enabled || !subjects.length) return result;

        const resolved = await Promise.all(
            subjects.map(async (subject) => {
                if (!mayPublish(this.config, subject.mimeType)) return null;
                const variants = subject.variants ?? {};
                const [original, ...derivatives] = await Promise.all([
                    this.ask(subject.storageKey, {
                        mimeType: subject.mimeType,
                        kind: subject.kind
                    }),
                    ...DERIVATIVES.map((name) => {
                        const key = Object.hasOwn(variants, name)
                            ? variants[name]?.key
                            : undefined;
                        return key
                            ? this.ask(key, {
                                  mimeType: DERIVATIVE_MIME_TYPE,
                                  kind: subject.kind,
                                  variant: name
                              })
                            : Promise.resolve(undefined);
                    })
                ]);
                if (!original) return null;
                const [thumb, preview] = derivatives;
                const thumbUrl = thumb?.url ?? original.thumbnailUrl;
                const streams = original.streams;
                const urls: AssetPublicUrls = {
                    url: original.url,
                    ...(thumbUrl ? { thumbUrl } : {}),
                    ...(preview?.url ? { previewUrl: preview.url } : {}),
                    ...(streams && (streams.hls || streams.dash)
                        ? {
                              streams: {
                                  ...(streams.hls ? { hls: streams.hls } : {}),
                                  ...(streams.dash
                                      ? { dash: streams.dash }
                                      : {})
                              }
                          }
                        : {})
                };
                return [subject.id, urls] as const;
            })
        );
        for (const entry of resolved) {
            if (entry) result.set(entry[0], entry[1]);
        }
        return result;
    }

    /**
     * One provider call, reduced to what is safe to report: a throw, or a URL
     * that is not absolute `http(s)`, becomes "no public URL" — the app's own
     * route, which is always correct — plus a warning naming the key, since a
     * silently missing CDN URL is otherwise invisible to an operator.
     */
    private async ask(
        storageKey: string,
        context: Parameters<NonNullable<StorageProvider['publicUrls']>>[1]
    ): Promise<PublicAssetUrls | undefined> {
        let answer: PublicAssetUrls | undefined;
        try {
            answer = await this.provider.publicUrls?.(storageKey, context);
        } catch (error) {
            this.logger.warn(
                `Storage provider "${this.provider.id}" failed to report public URLs for "${storageKey}"; ` +
                    `serving the app's own route instead. ${String(error)}`
            );
            return undefined;
        }
        if (answer === undefined || answer === null) return undefined;
        if (!isAbsoluteHttpUrl(answer.url)) {
            this.logger.warn(
                `Storage provider "${this.provider.id}" reported a public URL for "${storageKey}" that is not ` +
                    "an absolute http(s) URL; serving the app's own route instead."
            );
            return undefined;
        }
        const keep = (value: unknown) =>
            isAbsoluteHttpUrl(value) ? value : undefined;
        const thumbnailUrl = keep(answer.thumbnailUrl);
        const hls = keep(answer.streams?.hls);
        const dash = keep(answer.streams?.dash);
        return {
            url: answer.url,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            ...(hls || dash
                ? {
                      streams: {
                          ...(hls ? { hls } : {}),
                          ...(dash ? { dash } : {})
                      }
                  }
                : {})
        };
    }
}
