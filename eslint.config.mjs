import nx from '@nx/eslint-plugin';

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: [
            '**/dist',
            '**/out-tsc',
            // Vendored source, installed by `npx @tiptap/cli add simple-editor`
            // and kept byte-for-byte so a re-run diffs cleanly. Linting it to
            // our conventions would mean re-applying the reformat on every
            // upstream update, and the whole point of a copied template is that
            // upstream stays readable against it.
            'packages/wysiwyg/admin/src/tiptap-ui/**',
            '**/vite.config.*.timestamp*',
            '**/vitest.config.*.timestamp*',
            '**/test-output'
        ]
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: [
                        {
                            sourceTag: '*',
                            onlyDependOnLibsWithTags: ['*']
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            '**/*.ts',
            '**/*.tsx',
            '**/*.cts',
            '**/*.mts',
            '**/*.js',
            '**/*.jsx',
            '**/*.cjs',
            '**/*.mjs'
        ],
        // Override or add rules here
        rules: {}
    }
];
