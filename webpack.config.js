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

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  // `npm run build:ha` (--env ha) targets the Home Assistant integration:
  // output goes into custom_components/sweethome3d/frontend/ and the editor
  // is wired to the integration's /api/sweethome3d/* endpoints.
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

    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',

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
        scriptLoading: 'blocking'
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/editor.html'),
        filename: 'editor.html',
        chunks: ['editor'],
        inject: 'body',
        scriptLoading: 'blocking'
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/vendor', to: 'vendor' },
          { from: 'public/src',    to: 'src' },
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
