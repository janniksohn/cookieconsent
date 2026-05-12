import path from 'path';
import fs from 'fs';
import { defineConfig } from 'rollup';
import terser from "@rollup/plugin-terser";
import cssnanoPlugin from 'cssnano';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import eslint from '@rollup/plugin-eslint';
import pkg from './package.json' with { type: "json"};

const srcDir = './src';
const distDir = './dist';
const cssComponentsDir = `${distDir}/css-components`;
const input = `${srcDir}/index.js`;
const productionMode = !process.env.ROLLUP_WATCH;

export const banner = `/*!
* CookieConsent ${pkg.version}
* ${pkg.repository.url}
* Author ${pkg.author}
* Released under the ${pkg.license} License
*/
`;

/**
 * Compile a CSS entry through PostCSS (Tailwind v4 + cleanup + minify)
 * and emit the result as a single CSS asset.
 */
function cssPlugin(postcssPlugins) {
    let entryId = null;

    return {
        name: 'cookieconsent-css',
        transform(code, id) {
            if (!/\.css$/.test(id)) return null;
            if (!entryId) entryId = id;
            return { code: 'export default "";', map: { mappings: '' } };
        },
        async generateBundle(outputOptions, bundle) {
            if (!entryId) return;

            const sourceCss = fs.readFileSync(entryId, 'utf8');

            const processed = await postcss(postcssPlugins.filter(Boolean))
                .process(sourceCss, { from: entryId });

            const outFile = outputOptions.file;
            const fileName = path.basename(outFile);

            for (const key of Object.keys(bundle)) {
                delete bundle[key];
            }

            this.emitFile({ type: 'asset', fileName, source: processed.css });
            entryId = null;
        }
    };
}

const cssComponents = [
    ['base.css', 'base.css'],
    ['components/consent-modal.css', 'consent-modal.css'],
    ['components/preferences-modal.css', 'preferences-modal.css'],
    ['dark-color-scheme.css', 'dark-scheme.css'],
    ['light-color-scheme.css', 'light-scheme.css'],
];

const postcssPlugins = [
    tailwindcss(),
    productionMode && cssnanoPlugin({
        preset: ["default", {
            discardComments: {
                removeAll: true,
            }
        }]
    })
];

const cssComponentsRollup = cssComponents.map(component => {
    const src = `${srcDir}/css/${component[0]}`;
    const dst = `${cssComponentsDir}/${component[1]}`;

    return {
        input: src,
        output: {
            file: dst,
        },
        plugins: cssPlugin(postcssPlugins)
    };
});

export const terserPlugin = terser({
    toplevel: true,
    format: {
        quote_style: 1,
        comments: /^!/
    },
    mangle: {
        properties: {
            regex: /^_/,
            reserved: ['__esModule', '_ccRun'],
            keep_quoted: true
        }
    },
    compress: {
        passes: 3,
        pure_funcs: [ 'debug', 'console.log']
    }
});

export default defineConfig(
    [
        {
            input: input,
            output: [
                {
                    file: pkg.main,
                    format: 'umd',
                    name: 'CookieConsent',
                    banner: banner
                },
                {
                    file: pkg.module,
                    format: "esm",
                    exports: "named",
                    banner: banner
                }
            ],
            plugins: [
                eslint({
                    fix: true,
                    include: ['./src/**'],
                    exclude: ['./src/css/**']
                }),
                productionMode && terserPlugin,
            ]
        },
        {
            input: `${srcDir}/css/index.css`,
            output: {
                file: `${distDir}/cookieconsent.css`,
            },
            plugins: cssPlugin(postcssPlugins)
        },
        ...cssComponentsRollup
    ]
);
