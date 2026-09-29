import { collection } from '../collection/define';
import { field } from '../fields';
import type { AnyContentType } from '../types/content-type';
import { computeBulkPublishVerdicts } from '../entries/infrastructure/persistence/bulk-publish-verdicts';
import {
    hasRequiredRelation,
    waivedRequiredRelations
} from './required-relation-waiver';

const person = collection('person', {
    fields: { name: field.text({ required: true }) }
});
const topic = collection('topic', {
    fields: { name: field.text() }
});

/** Publishable: every required column is nullable, so every kind can be waived. */
const post = collection('post', {
    publishable: true,
    fields: {
        title: field.text({ required: true }),
        author: field.relation({
            to: (): AnyContentType => person,
            required: true,
            onDelete: 'restrict'
        }),
        topics: field.relation({
            to: (): AnyContentType => topic,
            many: true,
            required: true
        }),
        editor: field.relation({ to: (): AnyContentType => person })
    }
});

/** Live: its required single relation is a NOT NULL column. */
const note = collection('note', {
    fields: {
        owner: field.relation({
            to: (): AnyContentType => person,
            required: true
        }),
        topics: field.relation({
            to: (): AnyContentType => topic,
            many: true,
            required: true
        })
    }
});

describe('waivedRequiredRelations [content:I-50]', () => {
    it('waives every required relation whose target type is not granted', () => {
        expect(waivedRequiredRelations(post, new Set(['post']))).toEqual(
            new Set(['author', 'topics'])
        );
    });

    it('waives nothing whose target is granted', () => {
        expect(
            waivedRequiredRelations(post, new Set(['post', 'person', 'topic']))
        ).toEqual(new Set());
        expect(
            waivedRequiredRelations(post, new Set(['post', 'person']))
        ).toEqual(new Set(['topics']));
    });

    it('never names an optional relation or a non-relation field', () => {
        const waived = waivedRequiredRelations(post, new Set());
        expect(waived.has('editor')).toBe(false);
        expect(waived.has('title')).toBe(false);
    });

    it('never waives a NOT NULL single relation on a non-publishable type', () => {
        expect(waivedRequiredRelations(note, new Set(['note']))).toEqual(
            new Set(['topics'])
        );
    });

    it('reports whether a type has any required relation at all', () => {
        expect(hasRequiredRelation(post)).toBe(true);
        expect(hasRequiredRelation(topic)).toBe(false);
    });
});

describe('computeBulkPublishVerdicts — waived fields', () => {
    const row = {
        id: 'e1',
        status: 'draft',
        title: 'Hello',
        authorId: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    it('does not list a waived required relation on the checklist', () => {
        const [verdict] = computeBulkPublishVerdicts(
            post,
            ['e1'],
            new Map([['e1', row]]),
            () => ({ valid: true, issues: [] }),
            new Set(['author', 'topics'])
        );
        expect(verdict.checks.map((check) => check.field)).toEqual(['title']);
    });

    it('still lists it when nothing is waived', () => {
        const [verdict] = computeBulkPublishVerdicts(
            post,
            ['e1'],
            new Map([['e1', row]]),
            () => ({ valid: true, issues: [] })
        );
        expect(verdict.checks.map((check) => check.field)).toEqual([
            'title',
            'author',
            'topics'
        ]);
    });
});
