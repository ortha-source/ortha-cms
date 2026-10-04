import { documentOf, typeOf } from '../../testing/fixtures';
import { renderAll } from './render-all';
import { renderTypeModule } from './render-type-module';

describe('renderTypeModule', () => {
    const event = typeOf(
        'event',
        {
            title: { type: 'text', required: true, admin: { group: 'main' } },
            host: { type: 'relation', to: 'author' },
            tags: { type: 'relation', to: 'tag', many: true },
            parent: { type: 'relation', to: 'event' }
        },
        {
            label: 'Events',
            publishable: true,
            groups: [{ key: 'main', label: 'Main', collapsed: true }]
        }
    );
    const kinds = {
        author: 'collection',
        tag: 'collection',
        home: 'single'
    } as const;
    const source = renderTypeModule(
        event,
        (name) => kinds[name as keyof typeof kinds] ?? 'collection'
    );

    it('starts with the ownership marker', () => {
        expect(source.split('\n')[0]).toBe(
            '// @orthacms-generated — managed by the Schema Builder.'
        );
    });

    it('imports the DSL and each related type once, sorted, never itself', () => {
        expect(source).toContain(
            "import { collection, field, type AnyContentType } from '@orthacms/content-server/define';"
        );
        expect(source).toContain(
            "import { author } from './author';\nimport { tag } from './tag';"
        );
        expect(source).not.toContain("from './event'");
    });

    it('declares the type with its options and its fields in order', () => {
        expect(source).toContain(
            "export const event = collection('event', { label: 'Events', publishable: true, groups: { main: { label: 'Main', collapsed: true } }, fields: {\n" +
                "title: field.text({ required: true, admin: { group: 'main' } }),\n" +
                'host: field.relation({ to: (): AnyContentType => author }),\n' +
                'tags: field.relation({ to: (): AnyContentType => tag, many: true }),\n' +
                'parent: field.relation({ to: (): AnyContentType => event })\n' +
                '} });'
        );
    });

    it('declares a page with single() and its path, and imports across folders', () => {
        const home = typeOf(
            'home',
            { hero: { type: 'relation', to: 'author' } },
            { kind: 'single', path: '/' }
        );
        const page = renderTypeModule(home, () => 'collection');
        expect(page).toContain(
            "import { single, field, type AnyContentType } from '@orthacms/content-server/define';"
        );
        expect(page).toContain(
            "import { author } from '../collections/author';"
        );
        expect(page).toContain(
            "export const home = single('home', { path: '/', fields: {"
        );
    });
});

describe('renderAll', () => {
    it('renders builder-owned and new types, never hand-written ones', () => {
        const files = renderAll(
            documentOf(
                typeOf('tag', { name: { type: 'text' } }),
                typeOf('event', { title: { type: 'text' } }, { origin: 'new' }),
                typeOf(
                    'article',
                    { title: { type: 'text' } },
                    { origin: 'code' }
                ),
                typeOf(
                    'home',
                    { title: { type: 'text' } },
                    { kind: 'single', path: '/' }
                )
            )
        );
        expect(Object.keys(files).sort()).toEqual([
            'collections/event.ts',
            'collections/tag.ts',
            'pages/home.ts'
        ]);
    });
});
