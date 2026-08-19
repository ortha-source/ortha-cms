import { collection } from '../../collection/define';
import { field } from '../../fields';

/**
 * The assumption the `?fields=` projection builder now rests on: a generated
 * content table exposes its columns as **own** properties, and exposes nothing
 * it merely inherits.
 *
 * Both halves matter, in opposite directions. If drizzle ever moved columns onto
 * a prototype, the `Object.hasOwn` guard in `PublicEntriesQuery.projection`
 * would silently drop every selected column and a sparse fieldset would return
 * the envelope alone — a wrong answer with a 200, which no other test would
 * catch. And if inherited members were *not* excluded, the guard would not be
 * doing its job: `?fields=constructor` reached that loop and put a class
 * function into the `.select()` list, i.e. a 500 out of drizzle on a public,
 * token-authenticated endpoint.
 *
 * So this pins the drizzle behaviour rather than our code, deliberately: it is
 * the thing an upgrade could change under us.
 */
const post = collection('proj_post', {
    publishable: true,
    fields: {
        title: field.text({}),
        views: field.number({})
    }
});

describe('generated content tables as a projection source', () => {
    const table = post.table as unknown as Record<string, unknown>;

    it.each(['title', 'views', 'id', 'createdAt', 'updatedAt', 'status'])(
        'exposes %s as an own property',
        (name) => {
            expect(Object.hasOwn(table, name)).toBe(true);
            expect(table[name]).toBeDefined();
        }
    );

    it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
        'does not own %s, though a bare lookup still resolves it',
        (name) => {
            // The bare lookup being truthy is the whole defect: it is what let
            // an inherited name past a `if (table[name])` check.
            expect(table[name]).toBeTruthy();
            expect(Object.hasOwn(table, name)).toBe(false);
        }
    );
});
