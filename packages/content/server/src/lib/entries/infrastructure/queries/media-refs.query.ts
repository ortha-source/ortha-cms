import { Injectable, Optional } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import {
    InjectMediaAssetResolver,
    type MediaAssetResolver
} from '../../../extension/media-asset-resolver';
import type { MediaRef } from '../../types/entry-list-view';

/**
 * Resolves the media fields of a `values` bag to display refs — the assets the
 * admin renders (name / thumbnail url / kind) instead of raw uuids. One batched
 * resolver lookup across every media id; an asset that can't be resolved
 * (deleted / cross-workspace) is kept **in order** as an id-only `missing` ref,
 * so a `multiple` field's list never runs shorter than what was stored.
 *
 * Shared by the entry-editor read (`GET …/:id/media`, against the live row's
 * values) and the revision preview (against a snapshot's values), so the two
 * can't drift. A no-op returning `{}` when no media resolver is bound.
 */
@Injectable()
export class MediaRefsQuery {
    constructor(
        @Optional()
        @InjectMediaAssetResolver()
        private readonly resolver?: MediaAssetResolver
    ) {}

    /** Resolve every media field's ids in `values` to ordered {@link MediaRef}s. */
    async forValues(
        type: AnyContentType,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<Record<string, MediaRef[]>> {
        const out: Record<string, MediaRef[]> = {};
        if (!this.resolver) return out;

        const byField: Record<string, string[]> = {};
        const all = new Set<string>();
        for (const [name, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Media) continue;
            const value = values[name];
            const ids = Array.isArray(value)
                ? value.filter(
                      (id): id is string => typeof id === 'string' && !!id
                  )
                : typeof value === 'string' && value
                  ? [value]
                  : [];
            if (!ids.length) continue;
            byField[name] = ids;
            for (const id of ids) all.add(id);
        }
        if (!all.size) return out;

        const resolved = await this.resolver.resolve([...all], workspaceId);
        for (const [name, ids] of Object.entries(byField)) {
            out[name] = ids.map((id) => {
                const asset = resolved.get(id);
                return asset
                    ? {
                          id: asset.id,
                          name: asset.name,
                          url: asset.url,
                          // Only when the resolver has them — an asset with no
                          // derivative keeps the ref clean rather than carrying
                          // an undefined the admin has to test twice.
                          ...(asset.thumbUrl
                              ? { thumbUrl: asset.thumbUrl }
                              : {}),
                          ...(asset.previewUrl
                              ? { previewUrl: asset.previewUrl }
                              : {}),
                          kind: asset.kind,
                          mimeType: asset.mimeType,
                          alt: asset.alt
                      }
                    : {
                          id,
                          name: id,
                          url: '',
                          kind: '',
                          mimeType: '',
                          missing: true
                      };
            });
        }
        return out;
    }
}
