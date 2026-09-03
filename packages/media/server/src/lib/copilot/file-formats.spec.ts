import {
    FILE_FORMATS,
    FILE_FORMAT_NAMES,
    InvalidProposedFileNameError,
    MAX_FILE_NAME_LENGTH,
    isFileFormat,
    resolveFileName
} from './file-formats';

describe('isFileFormat', () => {
    it.each(FILE_FORMAT_NAMES)('accepts %s', (name) => {
        expect(isFileFormat(name)).toBe(true);
    });

    // The guard is the reason a model cannot name its own MIME type. Each of
    // these is a shape a plausible model output takes.
    it.each([
        ['a MIME type', 'text/markdown'],
        ['an unsupported format', 'pdf'],
        ['an executable extension', 'exe'],
        ['the empty string', ''],
        ['a number', 1],
        ['null', null],
        ['undefined', undefined]
    ])('rejects %s', (_label, value) => {
        expect(isFileFormat(value)).toBe(false);
    });

    // `FILE_FORMATS` is a plain object literal, so a bare `in` check would
    // resolve inherited members and hand `FILE_FORMATS['toString']` — which is
    // a function, not a descriptor — to the applier.
    it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
        'rejects the prototype member %s',
        (member) => {
            expect(isFileFormat(member)).toBe(false);
        }
    );
});

describe('resolveFileName', () => {
    it('appends the extension the format implies', () => {
        expect(resolveFileName('Q3 content audit', 'md')).toBe(
            'Q3 content audit.md'
        );
        expect(resolveFileName('entries', 'csv')).toBe('entries.csv');
    });

    it('leaves an already-correct extension alone', () => {
        expect(resolveFileName('report.md', 'md')).toBe('report.md');
    });

    it('is case-insensitive about the extension it recognises', () => {
        expect(resolveFileName('REPORT.MD', 'md')).toBe('REPORT.md');
    });

    // A model told to write Markdown will still sometimes propose `.txt`.
    // Replacing rather than appending is what keeps the name honest about the
    // MIME type the file is actually stored as.
    it('replaces an extension belonging to another supported format', () => {
        expect(resolveFileName('summary.txt', 'md')).toBe('summary.md');
        expect(resolveFileName('data.json', 'csv')).toBe('data.csv');
    });

    // `.q3` is far more likely to be part of the name than a claim about the
    // contents, so it survives and the real extension is added after it.
    it('keeps an extension it does not own', () => {
        expect(resolveFileName('2026.q3', 'md')).toBe('2026.q3.md');
        expect(resolveFileName('archive.tar', 'txt')).toBe('archive.tar.txt');
    });

    it('trims surrounding whitespace', () => {
        expect(resolveFileName('  notes  ', 'txt')).toBe('notes.txt');
    });

    // The whole name is an extension: stripping would leave nothing, and
    // `.md.md` is a better outcome than an empty name or a thrown error.
    it('keeps a name that is only an extension as the stem', () => {
        expect(resolveFileName('.md', 'md')).toBe('.md.md');
    });

    describe('rejections', () => {
        // The one that matters: a model asked for a report proposes
        // `reports/2026/q3.md` readily. Flattening it silently would file the
        // report at the root while the model told the user otherwise.
        it.each([
            ['a posix path', 'reports/2026/q3.md'],
            ['a windows path', 'reports\\q3.md'],
            ['a bare separator', '/'],
            ['a traversal attempt', '../../etc/passwd']
        ])('rejects %s', (_label, name) => {
            expect(() => resolveFileName(name, 'md')).toThrow(
                InvalidProposedFileNameError
            );
        });

        it('names the folder parameter in the path message [media:I-32]', () => {
            expect(() => resolveFileName('reports/q3', 'md')).toThrow(
                /folderId/
            );
        });

        it.each([
            ['an empty name', ''],
            ['whitespace only', '   ']
        ])('rejects %s', (_label, name) => {
            expect(() => resolveFileName(name, 'md')).toThrow(
                InvalidProposedFileNameError
            );
        });

        // Checked here rather than left to `FileName`, so the failure arrives
        // as a tool error the model can shorten and retry — inside the applier
        // the change is already recorded and there is nobody left to retry for.
        it('rejects a name that would exceed the storable length', () => {
            const name = 'a'.repeat(MAX_FILE_NAME_LENGTH);
            expect(() => resolveFileName(name, 'md')).toThrow(
                InvalidProposedFileNameError
            );
        });

        it('accepts a name that fits exactly once the extension is added', () => {
            const stem = 'a'.repeat(MAX_FILE_NAME_LENGTH - '.md'.length);
            expect(resolveFileName(stem, 'md')).toHaveLength(
                MAX_FILE_NAME_LENGTH
            );
        });
    });
});

describe('FILE_FORMATS', () => {
    // Nothing type-checks a format's MIME type against `MediaKind.classify`,
    // and the point of the closed enum is that a generated file can never be
    // stored as something executable.
    it('maps every format to a text MIME type', () => {
        for (const name of FILE_FORMAT_NAMES) {
            const { mimeType } = FILE_FORMATS[name];
            expect(
                mimeType.startsWith('text/') || mimeType === 'application/json'
            ).toBe(true);
        }
    });

    it('gives every format a distinct extension', () => {
        const extensions = FILE_FORMAT_NAMES.map(
            (name) => FILE_FORMATS[name].extension
        );
        expect(new Set(extensions).size).toBe(extensions.length);
    });
});
