/**
 * A content type a workspace can be granted access to. The real source of truth
 * will be code-defined collections/pages once a content-modeling plugin ships;
 * for now this is a server-owned mock, exposed by `GET /api/content-types` and
 * reused by the workspace create flow to expand an "all content" grant.
 */
export interface ContentTypeDescriptor {
    /** Stable machine name / slug. */
    name: string;
    /** Multi-entry collection vs. standalone page. */
    kind: 'collection' | 'single';
    /** Human label; falls back to `name`. */
    label?: string;
    /** Short description shown under the label. */
    description?: string;
    /** Route path — pages only. */
    path?: string;
}

/**
 * MOCK content catalogue. Mirrors the admin stub so the wizard renders real
 * data end-to-end; replace with the code-defined registry when content modeling
 * lands. The `name` of each entry is the slug stored in `workspace_content`.
 */
export const CONTENT_TYPES: readonly ContentTypeDescriptor[] = [
    {
        name: 'blog_post',
        kind: 'collection',
        label: 'Blog posts',
        description: 'Articles for the marketing blog.'
    },
    {
        name: 'product',
        kind: 'collection',
        label: 'Products',
        description: 'Catalog entries with pricing and media.'
    },
    {
        name: 'author',
        kind: 'collection',
        label: 'Authors',
        description: 'Bylines shared across posts.'
    },
    {
        name: 'release_note',
        kind: 'collection',
        label: 'Release notes',
        description: 'Versioned changelog entries.'
    },
    {
        name: 'home',
        kind: 'single',
        label: 'Home',
        description: 'The site landing page.',
        path: '/'
    },
    {
        name: 'about',
        kind: 'single',
        label: 'About',
        description: 'Company and team overview.',
        path: '/about'
    },
    {
        name: 'contact',
        kind: 'single',
        label: 'Contact',
        description: 'Contact form and details.',
        path: '/contact'
    },
    {
        name: 'pricing',
        kind: 'single',
        label: 'Pricing',
        description: 'Plans and pricing tiers.',
        path: '/pricing'
    }
] as const;
