import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { article, author } from '../../../testing/document';
import { useNewField } from './index';

const document = { version: 1 as const, types: [article, author] };

describe('useNewField', () => {
    it('lets the machine name follow the label until it is typed by hand', () => {
        const { result } = renderHook(() => useNewField(document, 'article'));
        act(() => result.current.editor.setAdmin({ label: 'Reading time' }));
        expect(result.current.editor.entry.name).toBe('readingTime');

        act(() => result.current.editor.setName('minutes'));
        act(() =>
            result.current.editor.setAdmin({ label: 'Reading time (min)' })
        );
        expect(result.current.editor.entry.name).toBe('minutes');
    });

    it('starts the spec over on another kind, keeping the label and the name', () => {
        const { result } = renderHook(() => useNewField(document, 'article'));
        act(() => result.current.editor.setAdmin({ label: 'Summary' }));
        act(() => result.current.editor.setSpec({ maxLength: 80 }));
        act(() => result.current.choose('longtext'));
        expect(result.current.choice).toBe('longtext');
        expect(result.current.editor.entry).toMatchObject({
            name: 'summary',
            spec: {
                type: 'richtext',
                admin: { widget: 'textarea', label: 'Summary' }
            }
        });
        expect(result.current.editor.entry.spec).not.toHaveProperty(
            'maxLength'
        );
    });

    it('says why a name cannot be used', () => {
        const { result } = renderHook(() => useNewField(document, 'article'));
        expect(result.current.nameProblem).toBe('empty');
        act(() => result.current.editor.setName('2fast'));
        expect(result.current.nameProblem).toBe('invalid');
        act(() => result.current.editor.setName('title'));
        expect(result.current.nameProblem).toBe('taken');
        act(() => result.current.editor.setName('subtitle'));
        expect(result.current.nameProblem).toBeNull();
    });

    it('reads the schema rules on the field as it would land in the draft [schema-builder:I-10]', () => {
        const { result } = renderHook(() => useNewField(document, 'article'));
        act(() => result.current.editor.setName('status'));
        expect(result.current.issues.map((issue) => issue.code)).toContain(
            'field.reserved-column'
        );
    });
});
