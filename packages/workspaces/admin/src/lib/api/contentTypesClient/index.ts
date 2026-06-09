import type { ContentType } from '../../types/wizard';

// TODO(content-types-server): replace this in-memory list with `apiClient.get`
// against `GET /api/content-types` once the content-types server plugin ships.
// `listContentTypes` is the contract the real client satisfies.

const CONTENT_TYPES: ContentType[] = [
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
];

/** Lists every content type defined in the project. */
export async function listContentTypes(): Promise<ContentType[]> {
    return structuredClone(CONTENT_TYPES);
}
