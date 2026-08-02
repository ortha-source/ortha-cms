const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
    output: {
        path: join(__dirname, 'dist'),
        // `dev:build` (watch) runs alongside `dev:run`, which holds
        // `node --watch` on dist/main.js. Cleaning on the watcher's first
        // compile would delete that file out from under the runner — and
        // `node --watch` cannot recover from a missing entry point, it just
        // hangs. `dev:prebuild` still cleans, so dist is never stale.
        clean: process.env.NX_WATCH_BUILD !== 'true',
        ...(process.env.NODE_ENV !== 'production' && {
            devtoolModuleFilenameTemplate: '[absolute-resource-path]'
        })
    },
    plugins: [
        new NxAppWebpackPlugin({
            target: 'node',
            compiler: 'tsc',
            main: './src/main.ts',
            tsConfig: './tsconfig.app.json',
            assets: ['./src/assets'],
            optimization: false,
            outputHashing: 'none',
            generatePackageJson: false,
            sourceMap: true
        })
    ]
};
