/**
 * Sweet Home 3D web editor -- entry point.
 *
 * The vendor scripts (big, gl-matrix, jszip, jsXmlSaxParser), the hand-written
 * src/*.js files and the JSweet-transpiled output (SweetHome3D.js, geom.js,
 * swingundo.js, batik-svgpathparser.js) are ALL loaded via <script> tags in
 * `public/editor.html` BEFORE this bundle runs, so globals like
 * `SweetHome3DJSApplication`, `ZIPTools`, `Home`, and `HomePane` are already
 * defined when this code executes.
 *
 * NOTE: we deliberately do NOT `import './styles.css'` here -- that file is
 * the 3D-viewer page's dark-theme stylesheet (`background: #1f2933` on
 * html/body) which would override the editor's layout. The editor's styles
 * live in `public/editor.html` (inline <style> + <link rel="stylesheet"
 * href="vendor/sweethome3djs.css">) and load synchronously from the HTML,
 * before this bundle runs.
 *
 * Gotchas worth preserving:
 *
 * 1. DO NOT pass `furnitureCatalogURLs: []` / `texturesCatalogURLs: []`.
 *    `RecordedUserPreferences` keeps those arrays verbatim; later
 *    `updateDefaultCatalogs` checks `Array.isArray(...)` -- and
 *    `Array.isArray([])` is true, so it takes the URL-loader path and calls
 *    `new DefaultFurnitureCatalog([], undefined)`, which then follows the
 *    one-arg branch (because the 2nd arg is undefined) and throws
 *    `[].getResourceBundles is not a function`. Omitting the options leaves
 *    the fields undefined, `Array.isArray(undefined)` is false, and the
 *    fallback `new DefaultFurnitureCatalog(preferences)` path is taken.
 *
 * 2. `editor.html` MUST use standards mode AND set `html { height: 100% }`.
 *    The CSS uses `body { height: 100% }` which needs an ancestor height
 *    to resolve against. Without it, all the position:absolute panes using
 *    `calc(100% - 30px)` collapse to 0 and the page renders blank.
 *    (testHome.html sidesteps this by omitting <!doctype html>, i.e.
 *    running in quirks mode. We keep standards mode.)
 */

function initEditor() {
  if (typeof window.SweetHome3DJSApplication !== 'function') {
    var msg =
      '[SweetHome3D] Global `SweetHome3DJSApplication` is not defined. ' +
      'Check that the vendor + src scripts in editor.html loaded before bundle.js.';
    // eslint-disable-next-line no-console
    console.error(msg);
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<pre style="color:#c0392b;padding:20px;font-family:monospace;">' +
        msg +
        '</pre>'
    );
    return;
  }

  var configuration = {
    includeAllContent: true,
    compressionLevel: 0,
    writeHomeWithWorker: false,
    autoRecovery: false
  };

  // __HA_BUILD__ is injected by webpack's DefinePlugin (true for build:ha).
  // With readHomeURL set (and writeHomeEditsURL absent) the application uses
  // DirectHomeRecorder against the Home Assistant integration's API:
  // GET/POST /api/home_3d_dashboard/homes/{name}, GET list, GET ?action=delete.
  if (__HA_BUILD__) {
    configuration.readHomeURL = '/api/home_3d_dashboard/homes/%s';
    configuration.writeHomeURL = '/api/home_3d_dashboard/homes/%s';
    configuration.listHomesURL = '/api/home_3d_dashboard/homes';
    configuration.deleteHomeURL = '/api/home_3d_dashboard/homes/%s?action=delete';
    configuration.defaultHomeName = 'default';
  }

  var application = new window.SweetHome3DJSApplication(configuration);

  // In the HA build homes are addressed by NAME (formatted into readHomeURL
  // by DirectHomeRecorder); in the plain web build by direct URL.
  var homeURL = __HA_BUILD__
    ? 'default'
    : window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) +
      'assets/default.sh3d';

  application.getHomeRecorder().readHome(homeURL, {
    homeLoaded: function (home) {
      home.setName(__HA_BUILD__ ? 'default' : homeURL);
      application.addHome(home);
    },
    homeError: function (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[SweetHome3D] Could not load',
        homeURL,
        '-- starting with empty home.',
        err
      );
      try {
        var home = new window.Home();
        home.setName(__HA_BUILD__ ? 'default' : 'Untitled');
        application.addHome(home);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[SweetHome3D] Failed to create empty home:', e);
      }
    },
    progression: function () { /* no-op */ }
  });

  // Handy handle for poking at the app from DevTools.
  window.__sh3dApp = application;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}
