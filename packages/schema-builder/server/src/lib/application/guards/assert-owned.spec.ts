import { diffDocuments } from '@orthacms/schema-builder-domain';
import { documentOf, typeOf, withField } from '../../../testing/documents';
import { NotBuilderOwnedError } from '../../domain/errors';
import { assertOwned } from './assert-owned';

describe('assertOwned [schema-builder:I-02]', () => {
    const owned = typeOf('event', { title: { type: 'text' } });
    const hand = typeOf(
        'article',
        { title: { type: 'text' } },
        { origin: 'code' }
    );
    const current = documentOf(owned, hand);
    const check = (draft: ReturnType<typeof documentOf>) => () =>
        assertOwned(current, draft, diffDocuments(current, draft));

    it('passes changes to builder-owned types and new types', () => {
        const added = typeOf(
            'venue',
            { name: { type: 'text' } },
            { origin: 'new' }
        );
        expect(
            check(
                documentOf(
                    withField(owned, 'notes', { type: 'text' }),
                    hand,
                    added
                )
            )
        ).not.toThrow();
    });

    it('refuses a change to a hand-written type, naming it', () => {
        expect(
            check(documentOf(owned, withField(hand, 'notes', { type: 'text' })))
        ).toThrow(NotBuilderOwnedError);
        expect(
            check(documentOf(owned, withField(hand, 'notes', { type: 'text' })))
        ).toThrow(/article is written by hand/);
    });

    it('refuses removing a hand-written type', () => {
        expect(check(documentOf(owned))).toThrow(NotBuilderOwnedError);
    });

    it('refuses a draft that claims a hand-written type for the builder', () => {
        expect(
            check(documentOf(owned, { ...hand, origin: 'builder' }))
        ).toThrow(NotBuilderOwnedError);
    });
});
