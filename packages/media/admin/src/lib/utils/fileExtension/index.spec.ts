import { describe, expect, it } from 'vitest';
import { fileExtension } from './index';

describe('fileExtension', () => {
    it('upper-cases the last extension', () => {
        expect(fileExtension('report-q3.pdf')).toBe('PDF');
        expect(fileExtension('archive.tar.gz')).toBe('GZ');
    });

    it('has nothing to say about a name without one', () => {
        expect(fileExtension('README')).toBeNull();
        expect(fileExtension('.env')).toBeNull();
        expect(fileExtension('trailing.')).toBeNull();
        expect(fileExtension('notes.markdown-draft')).toBeNull();
    });
});
