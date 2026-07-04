/**
 * Webpack configuration for the Sweet Home 3D web app.
 *
 * We ship two HTML pages from the same build:
 *   /             — index.html  — lightweight 3D VIEWER
 *   /editor.html  — full 2D floor-plan + 3D editor
 *
 * Sweet Home 3D's JavaScript is authored as legacy global scripts (no ES
 * modules) and must be loaded in a specific order. Rather than bundle them
 * through webpack's module graph (which would wrap each file in a scope and
 * break their globals), we:
 *
 *   1. Copy the prebuilt vendor scripts from `public/vendor/`, the
 *      hand-written source files from `public/src/`, and the icon/cursor/
 *      pattern assets from `public/lib/resources/` into `dist/` with
 *      CopyWebpackPlugin.
 *   2. Let each HTML template (public/index.html, public/editor.html)
 *      load them via <script> tags in the correct order.
 *   3. Bundle only our own entry scripts (src/index.js, src/editor.js)
 *      through webpack, and let HtmlWebpackPlugin inject each bundle AFTER
 *      the vendor scripts using `scriptLoading: 'blocking'`.
 */

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { minify } = require('terser');

// Minifies the legacy engine scripts while copying them (the JSweet output
// SweetHome3D.js alone is 3.9 MB unminified). keep_fnames is REQUIRED:
// HomeRecorder maps content types through constructor.name, and other code
// relies on function-name reflection. Global (top-level) names are never
// mangled by terser for plain scripts, which these are.
const TERSER_OPTIONS = { keep_fnames: true, format: { comments: false } };

function minifyEngineScript(content, absoluteFrom) {
  if (!/\.js$/i.test(absoluteFrom) || /\.min\.js$/i.test(absoluteFrom)) {
    return content;
  }
  return minify(content.toString(), TERSER_OPTIONS).then(function (result) {
    return result.code;
  });
}

// Engine scripts of each page, in the exact order the upstream build loads
// them (legacy global scripts: order is load-bearing). In production the
// whole list (minus jszip, see below) is concatenated into ONE file per
// page to collapse the request waterfall: 52 blocking round-trips hurt on
// remote Home Assistant access even when every response is a 304.
//
// vendor/jszip.min.js stays a real <script> tag in both pages:
// ZIPTools.getScriptFolder() locates the vendor folder by finding that tag
// and half the UI resolves its images/cursors/resources relative to it.
const VIEWER_SCRIPTS = [
  'vendor/big.min.js',
  'vendor/gl-matrix-min.js',
  'vendor/jszip.min.js',
  'vendor/core.min.js',
  'vendor/geom.min.js',
  'vendor/stroke.min.js',
  'vendor/batik-svgpathparser.min.js',
  'vendor/jsXmlSaxParser.min.js',
  'vendor/triangulator.min.js',
  'vendor/viewmodel.min.js',
  'vendor/viewhome.min.js'
];
const EDITOR_SCRIPTS = [
  'vendor/big.min.js',
  'vendor/gl-matrix-min.js',
  'vendor/jszip.min.js',
  'vendor/jsXmlSaxParser.min.js',
  'src/core.js',
  'src/scene3d.js',
  'src/HTMLCanvas3D.js',
  'src/URLContent.js',
  'src/ModelLoader.js',
  'src/Triangulator.js',
  'src/OBJLoader.js',
  'src/DAELoader.js',
  'src/Max3DSLoader.js',
  'src/ModelManager.js',
  'src/ModelPreviewComponent.js',
  'vendor/geom.js',
  'vendor/stroke.min.js',
  'vendor/swingundo.js',
  'vendor/batik-svgpathparser.js',
  'src/CoreTools.js',
  'vendor/SweetHome3D.js',
  'src/ShapeTools.js',
  'src/HomeComponent3D.js',
  'src/Object3DBranch.js',
  'src/HomePieceOfFurniture3D.js',
  'src/Room3D.js',
  'src/Wall3D.js',
  'src/Ground3D.js',
  'src/Polyline3D.js',
  'src/DimensionLine3D.js',
  'src/Label3D.js',
  'src/TextureManager.js',
  'src/LengthUnit.js',
  'src/UserPreferences.js',
  'src/ContentDigestManager.js',
  'src/HomeRecorder.js',
  'src/graphics2d.js',
  'src/ResourceAction.js',
  'src/toolkit.js',
  'src/PlanComponent.js',
  'src/HomePane.js',
  'src/DefaultFurnitureCatalog.js',
  'src/DefaultTexturesCatalog.js',
  'src/FurnitureCatalogListPanel.js',
  'src/FurnitureTablePanel.js',
  'src/ColorButton.js',
  'src/TextureChoiceComponent.js',
  'src/ModelMaterialsComponent.js',
  'src/JSViewFactory.js',
  'src/DirectHomeRecorder.js',
  'src/IncrementalHomeRecorder.js',
  'src/SweetHome3DJSApplication.js'
];

function concatEngineScripts(scripts, isProd) {
  const code = scripts
    .filter(function (file) { return file !== 'vendor/jszip.min.js'; })
    .map(function (file) {
      return fs.readFileSync(path.resolve(__dirname, 'public', file), 'utf8');
    })
    .join('\n;\n');
  return isProd
    ? minify(code, TERSER_OPTIONS).then(function (result) { return result.code; })
    : code;
}

// The save worker (see HomeRecorder.writeHomeToZip) imports one script from
// a <script id="recorder-worker"> tag: a plain-script concatenation of
// URLContent.js + HomeRecorder.js, plus the zip download deduplication
// (workers have their own ZIPTools instance with the same thundering-herd
// flaw the pages had). zipDedupe.js is an ES module; stripping its `export`
// keyword makes it a plain script the worker can run.
function buildRecorderWorker(isProd) {
  const parts = ['public/src/URLContent.js', 'public/src/HomeRecorder.js']
    .map(function (file) {
      return fs.readFileSync(path.resolve(__dirname, file), 'utf8');
    });
  // Blob workers have a non-hierarchical base URL (blob:...), so an
  // XMLHttpRequest to a relative URL like /api/... throws "Invalid URL".
  // Content URLs are server-relative (/api/, /com/); resolve them against
  // the page origin, which the blob URL of the worker itself carries.
  parts.push(
    '(function() {\n' +
    '  var base = self.location.href;\n' +
    '  if (base.indexOf("blob:") === 0) { base = base.substring(5); }\n' +
    '  var origin = new URL(base).origin;\n' +
    '  var originalOpen = XMLHttpRequest.prototype.open;\n' +
    '  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {\n' +
    '    if (typeof url === "string" && url.indexOf("://") < 0\n' +
    '        && url.indexOf("data:") !== 0 && url.indexOf("blob:") !== 0) {\n' +
    '      url = new URL(url, origin).href;\n' +
    '    }\n' +
    '    return originalOpen.call(this, method, url,\n' +
    '        async === undefined ? true : async, user, password);\n' +
    '  };\n' +
    '})();\n');
  parts.push(
    fs.readFileSync(path.resolve(__dirname, 'src/zipDedupe.js'), 'utf8')
      .replace(/^export /m, '')
    + '\ninstallZipRequestDeduplication();\n');
  const code = parts.join('\n;\n');
  return isProd
    ? minify(code, TERSER_OPTIONS).then(function (result) { return result.code; })
    : code;
}

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  // `npm run build:ha` (--env ha) targets the Home Assistant integration:
  // output goes into custom_components/home_3d_dashboard/frontend/ and the
  // editor is wired to the integration's /api/home_3d_dashboard/* endpoints.
  const isHA = !!(env && env.ha);
  const outputDir = isHA
    ? path.resolve(__dirname, 'custom_components/home_3d_dashboard/frontend')
    : path.resolve(__dirname, 'dist');

  return {
    entry: {
      viewer: './src/index.js',
      editor: './src/editor.js'
    },

    output: {
      filename: isProd ? '[name].[contenthash:8].js' : '[name].bundle.js',
      path: outputDir,
      // `clean: true` would wipe dist/ before each build. On this Windows/WSL
      // mount, unlinking stale files throws EPERM, so we overwrite in place.
      // Use `npm run clean` (rimraf) from a shell that can delete them.
      clean: false,
      publicPath: ''
    },

    // No source maps in the HA build: they double the shipped payload and
    // are only useful when debugging the standalone build locally.
    devtool: isHA ? false : (isProd ? 'source-map' : 'eval-cheap-module-source-map'),

    module: {
      rules: [
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/[name][ext]' }
        }
      ]
    },

    plugins: [
      new webpack.DefinePlugin({
        __HA_BUILD__: JSON.stringify(isHA)
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        filename: 'index.html',
        chunks: ['viewer'],
        inject: 'body',
        scriptLoading: 'blocking',
        templateParameters: {
          engineScripts: isProd
            ? ['vendor/jszip.min.js', 'viewer-lib.js']
            : VIEWER_SCRIPTS
        }
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/editor.html'),
        filename: 'editor.html',
        chunks: ['editor'],
        inject: 'body',
        scriptLoading: 'blocking',
        templateParameters: {
          engineScripts: isProd
            ? ['vendor/jszip.min.js', 'editor-lib.js']
            : EDITOR_SCRIPTS
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/vendor', to: 'vendor',
            transform: isProd ? { transformer: minifyEngineScript, cache: true } : undefined },
          { from: 'public/src',    to: 'src',
            transform: isProd ? { transformer: minifyEngineScript, cache: true } : undefined },
          // Concatenated worker script for background saves; the file used
          // as `from` is just a placeholder to hook transform into the copy.
          // No transform cache: the output depends on URLContent.js and
          // HomeRecorder.js, which the cache key (placeholder file) misses.
          // Emitted at the root (NOT src/) so it isn't long-cached and
          // worker fixes reach browsers via revalidation.
          { from: 'src/zipDedupe.js', to: 'recorder-worker.js',
            transform: function () { return buildRecorderWorker(isProd); } },
          // Single-file engine bundles for each page (prod only, see
          // VIEWER_SCRIPTS/EDITOR_SCRIPTS above). Emitted at the frontend
          // root, which the HA integration serves WITHOUT long cache
          // headers, so upgrades take effect via cheap 304 revalidation.
          ...(isProd ? [
            { from: 'src/zipDedupe.js', to: 'viewer-lib.js',
              transform: function () { return concatEngineScripts(VIEWER_SCRIPTS, isProd); } },
            { from: 'src/zipDedupe.js', to: 'editor-lib.js',
              transform: function () { return concatEngineScripts(EDITOR_SCRIPTS, isProd); } }
          ] : []),
          { from: 'public/lib',    to: 'lib',    noErrorOnMissing: true },
          { from: 'public/assets', to: 'assets', noErrorOnMissing: true },
          // Default furniture catalog 3D models + thumbnails. The catalog
          // JSON (public/vendor/resources/DefaultFurnitureCatalog.json) stores
          // paths like "/com/eteks/sweethome3d/io/resources/bed140x190.obj"
          // -- absolute document-root URLs -- so the folder has to live at
          // that exact path under dist/ (and public/ for the dev server).
          { from: 'public/com',    to: 'com',    noErrorOnMissing: true },
          // GPL: distribution must ship the license texts alongside the code.
          { from: 'LICENSE.TXT',   to: 'licenses/LICENSE.TXT' },
          { from: 'COPYING.TXT',   to: 'licenses/COPYING.TXT' },
          { from: 'licenses',      to: 'licenses' }
        ]
      })
    ],

    devServer: {
      static: [{ directory: path.resolve(__dirname, 'public') }],
      port: 8080,
      hot: false,
      liveReload: true,
      open: true,
      client: { overlay: { errors: true, warnings: false } }
    },

    performance: { hints: false },
    optimization: { minimize: isProd }
  };
};
