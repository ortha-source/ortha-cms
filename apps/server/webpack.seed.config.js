const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const nodeExternals = require('webpack-node-externals');
const { join } = require('path');

/**
 * The dev seed (`dev/seed/main.ts`), built the way the server is — see
 * `webpack.config.js` for why `@orthacms/*` is bundled and everything else is
 * not. It needs a build at all because Nest's DI reads constructor types from
 * `emitDecoratorMetadata`, which esbuild-based runners (tsx) do not emit.
 */
module.exports = {
    externals: [
        nodeExternals({
            modulesDir: join(__dirname, '../../node_modules'),
            allowlist: [/^@orthacms\//]
        })
    ],
    output: {
        path: join(__dirname, 'dist-seed'),
        clean: true,
        devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },
    plugins: [
        new NxAppWebpackPlugin({
            target: 'node',
            compiler: 'tsc',
            main: './dev/seed/main.ts',
            tsConfig: './tsconfig.seed.json',
            optimization: false,
            outputHashing: 'none',
            generatePackageJson: false,
            sourceMap: true,
            externalDependencies: 'none',
            mergeExternals: true
        })
    ]
};
