/**
 * Imports furniture from official Sweet Home 3D .sh3f libraries into this
 * project's catalog.
 *
 * Usage: node scripts/import-sh3f.js <dir-with-sh3f-or-zip-files>
 *
 * For each library:
 *  - parses PluginFurnitureCatalog.properties (Java .properties format,
 *    ISO-8859-1 with \uXXXX escapes),
 *  - repackages every model as /com/eteks/sweethome3d/io/resources/<lib>/
 *    <base>.zip whose main OBJ is renamed to <base>.obj — the convention
 *    DefaultFurnitureCatalog.js getContent() relies on (jar:<zip>!/<base>.obj),
 *    with all sibling files (mtl, textures) alongside,
 *  - extracts the icon as <base>.png,
 *  - appends the catalog keys to public/vendor/resources/
 *    DefaultFurnitureCatalog.json with renumbered indices.
 *
 * Duplicates are skipped: same id#, or same (name#, category#, creator#)
 * as an existing or previously imported entry.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'public/vendor/resources/DefaultFurnitureCatalog.json');
const RESOURCES_DIR = path.join(ROOT, 'public/com/eteks/sweethome3d/io/resources');
const URL_BASE = '/com/eteks/sweethome3d/io/resources';

/* ------------------------- java properties parser ------------------------ */

function parseProperties(buffer) {
  // ISO-8859-1 + \uXXXX escapes, line continuations with trailing backslash
  const text = buffer.toString('latin1');
  const logicalLines = [];
  let pending = '';
  for (let rawLine of text.split(/\r?\n/)) {
    if (pending) {
      rawLine = pending + rawLine.replace(/^\s+/, '');
      pending = '';
    }
    if (/(^|[^\\])(\\\\)*\\$/.test(rawLine)) {
      pending = rawLine.slice(0, -1);
      continue;
    }
    logicalLines.push(rawLine);
  }
  const entries = {};
  for (const line of logicalLines) {
    const trimmed = line.replace(/^\s+/, '');
    if (!trimmed || trimmed[0] === '#' || trimmed[0] === '!') {
      continue;
    }
    let separator = -1;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '\\') {
        i++;
      } else if (ch === '=' || ch === ':') {
        separator = i;
        break;
      }
    }
    if (separator < 0) {
      continue;
    }
    const key = unescapeJava(trimmed.substring(0, separator).trim());
    const value = unescapeJava(trimmed.substring(separator + 1).replace(/^\s+/, ''));
    entries[key] = value;
  }
  return entries;
}

function unescapeJava(value) {
  return value.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, function (match, unicode, ch) {
    if (unicode) {
      return String.fromCharCode(parseInt(unicode, 16));
    }
    switch (ch) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      default: return ch;
    }
  });
}

/* --------------------------------- import -------------------------------- */

function safeBaseName(name, library, used) {
  let base = name.normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'model';
  let candidate = base;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = base + '_' + counter++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function groupCatalogEntries(properties) {
  const byIndex = new Map();
  for (const key of Object.keys(properties)) {
    const match = /^([A-Za-z]+)#(\d+)$/.exec(key);
    if (match) {
      const index = parseInt(match[2], 10);
      if (!byIndex.has(index)) {
        byIndex.set(index, {});
      }
      byIndex.get(index)[match[1]] = properties[key];
    }
  }
  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Usage: node scripts/import-sh3f.js <dir-with-sh3f-or-zip>');
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  let maxIndex = 0;
  const existingIds = new Set();
  const existingNameKeys = new Set();
  for (const key of Object.keys(catalog)) {
    const match = /^([A-Za-z]+)#(\d+)$/.exec(key);
    if (!match) {
      continue;
    }
    maxIndex = Math.max(maxIndex, parseInt(match[2], 10));
    if (match[1] === 'id') {
      existingIds.add(catalog[key]);
    }
  }
  for (let i = 1; i <= maxIndex; i++) {
    if (catalog['name#' + i] !== undefined) {
      existingNameKeys.add([catalog['name#' + i], catalog['category#' + i],
        catalog['creator#' + i]].join('||'));
    }
  }

  const archives = fs.readdirSync(sourceDir)
    .filter((file) => /\.(sh3f|zip)$/i.test(file))
    .map((file) => path.join(sourceDir, file));
  if (archives.length === 0) {
    console.error('No .sh3f/.zip archives found in ' + sourceDir);
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  let nextIndex = maxIndex + 1;

  for (const archivePath of archives) {
    // Distribution zips contain the .sh3f; open either directly
    let zip = new AdmZip(archivePath);
    const nested = zip.getEntries().find((entry) => /\.sh3f$/i.test(entry.entryName));
    if (nested) {
      zip = new AdmZip(nested.getData());
    }
    const propsEntry = zip.getEntries().find((entry) =>
      /(^|\/)PluginFurnitureCatalog\.properties$/.test(entry.entryName));
    if (!propsEntry) {
      console.warn('SKIP (no PluginFurnitureCatalog.properties): ' + archivePath);
      continue;
    }
    const library = path.basename(archivePath)
      .replace(/^3DModels-/, '').replace(/-1\.[\d.]+\.(zip|sh3f)$/i, '')
      .replace(/\.(zip|sh3f)$/i, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const libraryDir = path.join(RESOURCES_DIR, library);
    fs.mkdirSync(libraryDir, { recursive: true });

    const entriesByName = new Map();
    zip.getEntries().forEach((entry) => {
      entriesByName.set(entry.entryName, entry);
    });
    const catalogEntries = groupCatalogEntries(parseProperties(propsEntry.getData()));
    const usedBaseNames = new Set();
    console.log(library + ': ' + catalogEntries.length + ' catalog entries');

    // Folders shared by several models (e.g. the whole Contributions
    // library lives in ONE folder) must not be bundled wholesale into each
    // model zip — only referenced files are included for those.
    const modelsPerFolder = new Map();
    for (const entry of catalogEntries) {
      if (entry.model) {
        const folder = entry.model.replace(/^\//, '');
        const dir = folder.includes('/')
          ? folder.substring(0, folder.lastIndexOf('/') + 1) : '';
        modelsPerFolder.set(dir, (modelsPerFolder.get(dir) || 0) + 1);
      }
    }

    for (const entry of catalogEntries) {
      if (!entry.name || !entry.model || !entry.icon) {
        skipped++;
        continue;
      }
      const nameKey = [entry.name, entry.category, entry.creator].join('||');
      if ((entry.id && existingIds.has(entry.id)) || existingNameKeys.has(nameKey)) {
        skipped++;
        continue;
      }
      const modelEntryName = entry.model.replace(/^\//, '');
      const iconEntryName = entry.icon.replace(/^\//, '');
      const modelEntry = entriesByName.get(modelEntryName);
      const iconEntry = entriesByName.get(iconEntryName);
      if (!modelEntry || !iconEntry) {
        console.warn('  missing files for "' + entry.name + '" (' + entry.model + ')');
        skipped++;
        continue;
      }

      const base = safeBaseName(entry.name, library, usedBaseNames);
      // Repackage the model folder into <base>.zip with the main obj
      // renamed to <base>.obj (required by getContent's jar: convention)
      const modelDir = modelEntryName.includes('/')
        ? modelEntryName.substring(0, modelEntryName.lastIndexOf('/') + 1)
        : '';
      const outZip = new AdmZip();
      const mainFileName = modelEntryName.substring(modelDir.length);
      const mainExtension = path.extname(mainFileName);
      const sharedFolder = (modelsPerFolder.get(modelDir) || 1) > 1;
      let includedNames;
      if (!sharedFolder && modelDir !== '') {
        // Private folder: bundle everything in it
        includedNames = [...entriesByName.keys()].filter((name) =>
          name.startsWith(modelDir) && !entriesByName.get(name).isDirectory);
      } else {
        // Shared folder: follow references (OBJ -> mtllib -> texture maps)
        includedNames = [modelEntryName];
        if (/\.obj$/i.test(modelEntryName)) {
          const objText = entriesByName.get(modelEntryName).getData().toString('latin1');
          const mtlNames = [];
          for (const match of objText.matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gmi)) {
            mtlNames.push(match[1].trim());
          }
          for (const mtlName of mtlNames) {
            const mtlEntryName = modelDir + mtlName;
            const mtlEntry = entriesByName.get(mtlEntryName);
            if (!mtlEntry) {
              continue;
            }
            includedNames.push(mtlEntryName);
            const mtlText = mtlEntry.getData().toString('latin1');
            for (const match of mtlText.matchAll(/^[ \t]*(?:map_[A-Za-z]+|bump|disp|decal|refl)\b(.*)$/gmi)) {
              // Texture file = last whitespace token (map lines may carry options)
              const tokens = match[1].trim().split(/[ \t]+/);
              const textureName = tokens[tokens.length - 1];
              if (textureName && entriesByName.has(modelDir + textureName)) {
                includedNames.push(modelDir + textureName);
              }
            }
          }
        }
        includedNames = [...new Set(includedNames)];
      }
      let siblingCount = 0;
      for (const name of includedNames) {
        const data = entriesByName.get(name).getData();
        if (name === modelEntryName) {
          outZip.addFile(base + mainExtension, data);
        } else {
          outZip.addFile(name.substring(modelDir.length), data);
          siblingCount++;
        }
      }
      outZip.writeZip(path.join(libraryDir, base + '.zip'));
      fs.writeFileSync(path.join(libraryDir, base + '.png'), iconEntry.getData());

      const index = nextIndex++;
      for (const [property, value] of Object.entries(entry)) {
        if (property === 'icon') {
          catalog['icon#' + index] = URL_BASE + '/' + library + '/' + base + '.png';
        } else if (property === 'model') {
          catalog['model#' + index] = URL_BASE + '/' + library + '/' + base + '.zip';
        } else if (property === 'planIcon') {
          continue; // not extracted; the plan falls back to the icon
        } else {
          // trim: several engine parsers split numeric lists on spaces and
          // (unlike Java) choke on trailing whitespace in the value
          catalog[property + '#' + index] = String(value).trim();
        }
      }
      catalog['modelSize#' + index] = String(modelEntry.header.size);
      if (siblingCount > 0) {
        catalog['multiPartModel#' + index] = 'true';
      }
      if (entry.id) {
        existingIds.add(entry.id);
      }
      existingNameKeys.add(nameKey);
      imported++;
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 1) + '\n');
  console.log('\nImported ' + imported + ' models, skipped ' + skipped
    + ' (duplicates/incomplete). Catalog now ends at index ' + (nextIndex - 1) + '.');
}

main();
