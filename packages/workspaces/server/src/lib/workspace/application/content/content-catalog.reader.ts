import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ContentGrantKind } from '../../domain/content-grant';
import {
    CONTENT_CATALOG,
    type ContentCatalog
} from '../ports/content-catalog.port';
import type { ContentTypeDescriptor } from '../ports/content-type-descriptor';
import { CONTENT_TYPES } from '../../infrastructure/content/content-catalog.mock';

/** The catalogue's slugs, split by kind. */
export interface KnownSlugs {
    /** Collection slugs. */
    collections: string[];
    /** Single-page slugs. */
    pages: string[];
}

/**
 * Reads the content catalogue through the {@link CONTENT_CATALOG} port, falling
 * back to the built-in mock when no content plugin is bound. The single source
 * every workspace flow reads the catalogue through, so the catalogue-vs-mock
 * rule can't drift.
 */
@Injectable()
export class ContentCatalogReader {
    constructor(
        @Optional()
        @Inject(CONTENT_CATALOG)
        private readonly catalog?: ContentCatalog
    ) {}

    /** Every content type, from the bound catalogue or the mock fallback. */
    list(): readonly ContentTypeDescriptor[] {
        return this.catalog?.list() ?? CONTENT_TYPES;
    }

    /**
     * Resolves a slug to its catalogue kind, or `null` when the slug names no
     * known content type. Backs the single-grant add flow (the client sends only
     * a slug; the server derives the kind and rejects an unknown one).
     */
    resolveKind(slug: string): ContentGrantKind | null {
        return this.list().find((type) => type.name === slug)?.kind ?? null;
    }

    /** The catalogue's slugs, split by kind. */
    knownSlugs(): KnownSlugs {
        const types = this.list();
        return {
            collections: types
                .filter((type) => type.kind === 'collection')
                .map((type) => type.name),
            pages: types
                .filter((type) => type.kind === 'single')
                .map((type) => type.name)
        };
    }
}
