/**
 * Advanced editor chrome: a larger toolbar with Material Design Icons (the
 * icon set Home Assistant uses), text labels on the drawing tools, a "More"
 * menu for rarely used actions, shortcut tooltips, MDI icons in context
 * menus, and a hint bar explaining the current drawing tool.
 *
 * Works on the DOM HomePane builds (public/src/HomePane.js createToolBar):
 * the engine's buttons are moved into new groups, so their listeners and
 * enabled/selected state keep working. Styles: src/editorTheme.css.
 */

import {
  mdiAccountEditOutline, mdiAlignHorizontalDistribute, mdiAlignHorizontalLeft,
  mdiAlignHorizontalRight, mdiAlignVerticalBottom, mdiAlignVerticalTop,
  mdiArrowCollapseDown, mdiArrowDown, mdiArrowLeft, mdiArrowRight, mdiArrowUp,
  mdiBackspaceOutline, mdiBookshelf, mdiCameraBurst, mdiCameraOutline,
  mdiChevronDown, mdiChevronUp, mdiClose, mdiCogOutline, mdiCompassOutline,
  mdiContentCopy, mdiContentCut, mdiContentPaste, mdiContentSaveEditOutline,
  mdiContentSaveOutline, mdiCubeOutline, mdiCubeSend, mdiCursorDefaultOutline,
  mdiDeleteOutline, mdiDistributeHorizontalCenter, mdiDistributeVerticalCenter,
  mdiDockWindow, mdiDotsVertical, mdiExitToApp, mdiEyeOffOutline, mdiEyeOutline,
  mdiFastForward, mdiFileCogOutline, mdiFileDelimitedOutline, mdiFileEyeOutline,
  mdiFilePdfBox, mdiFilePlusOutline, mdiFlipHorizontal, mdiFlipVertical,
  mdiFloorPlan, mdiFolderOpenOutline, mdiFormatBold, mdiFormatFontSizeDecrease,
  mdiFormatFontSizeIncrease, mdiFormatItalic, mdiFormatPaint, mdiFormatText,
  mdiGroup, mdiHandBackRightOutline, mdiHelpCircleOutline, mdiHistory,
  mdiHomeOutline, mdiImageEditOutline, mdiImageOffOutline, mdiImageOutline,
  mdiImagePlusOutline, mdiImageRemoveOutline, mdiImport, mdiInformationOutline,
  mdiLayersEdit, mdiLayersMinus, mdiLayersOutline, mdiLayersPlus,
  mdiLayersTripleOutline, mdiLightbulbOnOutline, mdiLockOpenVariantOutline,
  mdiLockOutline, mdiMagnet, mdiMagnetOn, mdiMagnify, mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline, mdiMapMarkerOutline, mdiMapMarkerPlusOutline,
  mdiMapMarkerRemoveOutline, mdiMenu, mdiOpenInNew, mdiPause, mdiPencilOutline,
  mdiPlay, mdiPrinterOutline, mdiRecord, mdiRedo, mdiRestore, mdiRewind,
  mdiRotate3dVariant, mdiRuler, mdiSelectAll, mdiSelectGroup, mdiSkipBackward,
  mdiSkipForward, mdiSofaOutline, mdiSort, mdiSvg, mdiSwapHorizontal,
  mdiTableColumn, mdiTexture, mdiTextureBox, mdiTranslate, mdiUndo, mdiUngroup,
  mdiVectorLink, mdiVectorPolyline, mdiVideoOffOutline, mdiVideoOutline, mdiWalk,
  mdiWall, mdiZipBoxOutline
} from '@mdi/js';

var HINTS_KEY = 'home_3d_dashboard.drawingTips';

// Sweet Home 3D icon file name (public/vendor/resources/actions) -> MDI icon
var ICONS = {
  'align-back-side': mdiAlignVerticalTop,
  'align-front-side': mdiAlignVerticalBottom,
  'align-horizontal-left': mdiAlignHorizontalLeft,
  'align-horizontal-right': mdiAlignHorizontalRight,
  'align-left-side': mdiAlignHorizontalLeft,
  'align-right-side': mdiAlignHorizontalRight,
  'align-side-by-side': mdiAlignHorizontalDistribute,
  'align-vertical-bottom': mdiAlignVerticalBottom,
  'align-vertical-top': mdiAlignVerticalTop,
  'application-exit': mdiExitToApp,
  'application-preferences': mdiCogOutline,
  'camera-photo': mdiCameraOutline,
  'camera-photos-at-points-of-view': mdiCameraBurst,
  'camera-video': mdiVideoOutline,
  'delete-camera-path': mdiVideoOffOutline,
  'delete-last-record': mdiBackspaceOutline,
  'display-column': mdiTableColumn,
  'distribute-horizontally': mdiDistributeHorizontalCenter,
  'distribute-vertically': mdiDistributeVerticalCenter,
  'document-close': mdiClose,
  'document-new-from-demo': mdiHomeOutline,
  'document-new': mdiFilePlusOutline,
  'document-open-recent': mdiHistory,
  'document-open': mdiFolderOpenOutline,
  'document-page-setup': mdiFileCogOutline,
  'document-print-pdf': mdiFilePdfBox,
  'document-print-preview': mdiFileEyeOutline,
  'document-print': mdiPrinterOutline,
  'document-save-and-compress': mdiZipBoxOutline,
  'document-save-as': mdiContentSaveEditOutline,
  'document-save': mdiContentSaveOutline,
  'edit-clear': mdiDeleteOutline,
  'edit-copy': mdiContentCopy,
  'edit-cut': mdiContentCut,
  'edit-find': mdiMagnify,
  'edit-paste-style': mdiFormatPaint,
  'edit-paste-to-group': mdiContentPaste,
  'edit-paste': mdiContentPaste,
  'edit-redo': mdiRedo,
  'edit-select-all-at-all-levels': mdiSelectGroup,
  'edit-select-all': mdiSelectAll,
  'edit-undo': mdiUndo,
  'format-text-bold': mdiFormatBold,
  'format-text-decrease-size': mdiFormatFontSizeDecrease,
  'format-text-increase-size': mdiFormatFontSizeIncrease,
  'format-text-italic': mdiFormatItalic,
  'furniture-add-to-group': mdiGroup,
  'furniture-add': mdiSofaOutline,
  'furniture-export-csv': mdiFileDelimitedOutline,
  'furniture-import-library': mdiBookshelf,
  'furniture-import-texture': mdiTextureBox,
  'furniture-import-textures-library': mdiTexture,
  'furniture-import': mdiImport,
  'furniture-modify': mdiPencilOutline,
  'furniture-reset-elevation': mdiArrowCollapseDown,
  'go-down-small': mdiChevronDown,
  'go-down': mdiArrowDown,
  'go-next': mdiArrowRight,
  'go-previous': mdiArrowLeft,
  'go-up-small': mdiChevronUp,
  'go-up': mdiArrowUp,
  'group': mdiGroup,
  'help-about': mdiInformationOutline,
  'help-browser': mdiHelpCircleOutline,
  'language-import': mdiTranslate,
  'media-playback-pause': mdiPause,
  'media-playback-start': mdiPlay,
  'media-record': mdiRecord,
  'media-seek-backward': mdiRewind,
  'media-seek-forward': mdiFastForward,
  'media-skip-backward': mdiSkipBackward,
  'media-skip-forward': mdiSkipForward,
  'plan-add-level-same-elevation': mdiLayersPlus,
  'plan-add-level': mdiLayersPlus,
  'plan-create-dimension-lines': mdiRuler,
  'plan-create-labels': mdiFormatText,
  'plan-create-polylines': mdiVectorPolyline,
  'plan-create-rooms': mdiFloorPlan,
  'plan-create-walls': mdiWall,
  'plan-delete-background-image': mdiImageRemoveOutline,
  'plan-delete-level': mdiLayersMinus,
  'plan-export-svg': mdiSvg,
  'plan-flip-horizontally': mdiFlipHorizontal,
  'plan-flip-vertically': mdiFlipVertical,
  'plan-hide-background-image': mdiImageOffOutline,
  'plan-import-background-image': mdiImagePlusOutline,
  'plan-join-walls': mdiVectorLink,
  'plan-locked': mdiLockOutline,
  'plan-make-all-levels-viewable': mdiLayersOutline,
  'plan-make-level-only-viewable-one': mdiLayersTripleOutline,
  'plan-make-level-unviewable': mdiEyeOffOutline,
  'plan-make-level-viewable': mdiEyeOutline,
  'plan-modify-background-image': mdiImageEditOutline,
  'plan-modify-compass': mdiCompassOutline,
  'plan-modify-dimension-lines': mdiRuler,
  'plan-modify-label': mdiFormatText,
  'plan-modify-level': mdiLayersEdit,
  'plan-modify-polylines': mdiVectorPolyline,
  'plan-modify-rooms': mdiFloorPlan,
  'plan-modify-walls': mdiWall,
  'plan-pan': mdiHandBackRightOutline,
  'plan-reverse-walls-direction': mdiSwapHorizontal,
  'plan-select': mdiCursorDefaultOutline,
  'plan-show-background-image': mdiImageOutline,
  'plan-split-wall': mdiContentCut,
  'plan-unlocked': mdiLockOpenVariantOutline,
  'plan-zoom-in': mdiMagnifyPlusOutline,
  'plan-zoom-out': mdiMagnifyMinusOutline,
  'preferences-magnetism-disabled': mdiMagnet,
  'preferences-magnetism-enabled': mdiMagnetOn,
  'reset-orientation': mdiRestore,
  'sort-by': mdiSort,
  'ungroup': mdiUngroup,
  'view3d-attach': mdiDockWindow,
  'view3d-delete-points-of-view': mdiMapMarkerRemoveOutline,
  'view3d-detach': mdiOpenInNew,
  'view3d-display-all-levels': mdiLayersOutline,
  'view3d-display-selected-level': mdiLayersTripleOutline,
  'view3d-export-obj': mdiCubeSend,
  'view3d-go-to-point-of-view': mdiMapMarkerOutline,
  'view3d-modify-observer': mdiAccountEditOutline,
  'view3d-modify': mdiCubeOutline,
  'view3d-store-point-of-view': mdiMapMarkerPlusOutline,
  'view3d-view-from-observer': mdiWalk,
  'view3d-view-from-top': mdiRotate3dVariant,
  'menu': mdiMenu
};

// Toolbar groups, by action (button ids are "toolbar-button-" + action)
var TOOLBAR = [
  ['SAVE'],
  ['UNDO', 'REDO'],
  ['SELECT', 'PAN', 'CREATE_WALLS', 'CREATE_ROOMS', 'CREATE_POLYLINES',
    'CREATE_DIMENSION_LINES', 'CREATE_LABELS'],
  ['ADD_HOME_FURNITURE', 'DELETE', 'COPY', 'PASTE'],
  ['ENABLE_MAGNETISM', 'LOCK_BASE_PLAN'],
  ['ZOOM_IN', 'ZOOM_OUT'],
  ['VIEW_FROM_TOP', 'VIEW_FROM_OBSERVER']
];
// "More" menu sections; buttons not listed anywhere also end up here
var MORE = [
  ['NEW_HOME', 'OPEN', 'SAVE_AS'],
  ['CUT', 'FLIP_HORIZONTALLY', 'FLIP_VERTICALLY'],
  ['INCREASE_TEXT_SIZE', 'DECREASE_TEXT_SIZE', 'TOGGLE_BOLD_STYLE', 'TOGGLE_ITALIC_STYLE'],
  ['ABOUT']
];
var END = ['PREFERENCES'];

// Buttons that swap actions keep the id of the action they started with
var ALIASES = {
  DISABLE_MAGNETISM: 'ENABLE_MAGNETISM',
  UNLOCK_BASE_PLAN: 'LOCK_BASE_PLAN',
  DELETE_SELECTION: 'DELETE'
};

// Short text labels shown next to the icons of the drawing tools, and of
// buttons whose icon alone says little
var LABELS = {
  SELECT: 'Select',
  CREATE_WALLS: 'Walls',
  CREATE_ROOMS: 'Rooms',
  CREATE_DIMENSION_LINES: 'Dimensions',
  CREATE_LABELS: 'Text',
  ADD_HOME_FURNITURE: 'Add to home'
};

// What to do in each plan mode (the web engine has no keyboard length entry)
var HINTS = {
  PAN: 'Drag to move around the plan. Use the mouse wheel to zoom.',
  CREATE_WALLS: 'Click to start a wall, click at each corner, double-click to finish. ' +
    'Double-click inside a room to surround it with walls. Esc stops.',
  CREATE_ROOMS: 'Click at each corner of the room and double-click the last one, ' +
    'or double-click inside walls to fill that space. Esc stops.',
  CREATE_POLYLINES: 'Click to add points, double-click to finish. Esc stops.',
  CREATE_DIMENSION_LINES: 'Click where the measure starts and ends, then move to place it and click. ' +
    'Double-click a wall or a piece to measure it.',
  CREATE_LABELS: 'Click where the text should go.'
};

/** CSS url() of an MDI icon as an SVG data URI. */
export function iconUrl(path, fill) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path fill="' + (fill || '#000') + '" d="' + path + '"/></svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

// "url(".../resources/actions/edit-undo.svg")" or an img src -> "edit-undo"
function iconName(url) {
  var match = /([\w-]+)(?:@2x)?\.(?:svg|png|gif)\W*$/i.exec(url || '');
  return match ? match[1] : null;
}

function setMask(node, url) {
  node.style.webkitMaskImage = url;
  node.style.maskImage = url;
}

function storedHints() {
  try {
    return window.localStorage.getItem(HINTS_KEY) !== 'off';
  } catch (e) {
    return true;
  }
}

function formatShortcut(accelerator) {
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  return String(accelerator).trim().split(/\s+/).map(function (part) {
    switch (part.toLowerCase()) {
      case 'control': return mac ? '⌃' : 'Ctrl';
      case 'meta': return mac ? '⌘' : 'Meta';
      case 'shift': return mac ? '⇧' : 'Shift';
      case 'alt': return mac ? '⌥' : 'Alt';
      case 'delete': return mac ? '⌫' : 'Del';
      case 'back_space': return mac ? '⌫' : 'Backspace';
      default: return part.length === 1 ? part.toUpperCase() : part.charAt(0) + part.slice(1).toLowerCase();
    }
  }).join(mac ? '' : '+');
}

/**
 * @param {SweetHome3DJSApplication} application
 * @param {{homePicker?: HTMLElement}} [options] homePicker: the list of
 *   homes (src/homes.js createHomePicker), shown before the ⋮ button
 */
export function installAdvancedUi(application, options) {
  options = options || {};
  var toolbar = document.getElementById('home-pane-toolbar');
  if (!toolbar) {
    return;
  }
  var AbstractAction = window.AbstractAction;
  var ResourceAction = window.ResourceAction;

  var hintsOn = storedHints();
  var menu = document.createElement('div');
  menu.id = 'h3d-more-menu';
  document.body.appendChild(menu);
  var moreButton = null;
  var tipsButton = null;

  var hint = document.createElement('div');
  hint.id = 'h3d-hint';
  var hintText = document.createElement('span');
  var hintClose = document.createElement('button');
  hintClose.textContent = '×';
  hintClose.title = 'Hide drawing tips (turn them back on from the ⋮ menu)';
  hintClose.addEventListener('click', function () {
    setHints(false);
  });
  hint.appendChild(hintText);
  hint.appendChild(hintClose);
  document.body.appendChild(hint);

  /* ------------------------------ buttons ------------------------------ */

  function keyOf(button) {
    var key = button.id.replace(/^toolbar-button-/, '');
    return ALIASES[key] || key;
  }

  function actionValue(button, name) {
    try {
      return button.action ? button.action.getValue(name) : null;
    } catch (e) {
      return null;
    }
  }

  // Adds the MDI icon and label to an engine button, and keeps them (and
  // the tooltip) in sync when the engine swaps the button's action.
  function decorate(button) {
    var icon = button.querySelector('.h3d-ico');
    var label = button.querySelector('.h3d-label');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'h3d-ico';
      label = document.createElement('span');
      label.className = 'h3d-label';
      button.appendChild(icon);
      button.appendChild(label);
    }
    var key = keyOf(button);
    var name = iconName(button.style.backgroundImage);
    var path = name && ICONS[name];
    // Unknown icons keep their own picture, as a single-color silhouette
    var mask = path ? iconUrl(path) : (button.style.backgroundImage || '');
    if (icon.dataset.mask !== mask) {
      icon.dataset.mask = mask;
      setMask(icon, mask);
    }
    var actionName = String(actionValue(button, AbstractAction && AbstractAction.NAME) || '')
      .replace(/(\.\.\.|…)$/, '');
    var text = LABELS[key] || actionName;
    if (label.textContent !== text) {
      label.textContent = text;
    }
    button.classList.toggle('h3d-labeled', !!LABELS[key]);
    var description = actionValue(button, AbstractAction && AbstractAction.SHORT_DESCRIPTION) || actionName;
    var accelerator = actionValue(button, AbstractAction && AbstractAction.ACCELERATOR_KEY);
    var title = description + (accelerator ? ' (' + formatShortcut(accelerator) + ')' : '');
    if (title && button.title !== title) {
      button.title = title;
    }
  }

  function group(className) {
    var node = document.createElement('span');
    node.className = 'h3d-group' + (className ? ' ' + className : '');
    return node;
  }

  /* ------------------------------ layout ------------------------------- */

  var layingOut = false;

  function layout() {
    var buttons = {};
    var order = [];
    Array.prototype.forEach.call(toolbar.querySelectorAll('.toolbar-button'), function (button) {
      var key = keyOf(button);
      if (!buttons[key] && !button.classList.contains('h3d-more-button')) {
        buttons[key] = button;
        order.push(key);
      }
    });
    if (order.length === 0) {
      return;
    }
    layingOut = true;
    closeMenu();
    var used = {};
    while (toolbar.firstChild) {
      toolbar.removeChild(toolbar.firstChild);
    }
    menu.innerHTML = '';

    TOOLBAR.forEach(function (keys) {
      var node = group();
      keys.forEach(function (key) {
        if (buttons[key]) {
          used[key] = true;
          decorate(buttons[key]);
          node.appendChild(buttons[key]);
        }
      });
      if (node.firstChild) {
        toolbar.appendChild(node);
      }
    });

    var spacer = document.createElement('span');
    spacer.className = 'h3d-spacer';
    toolbar.appendChild(spacer);

    var end = group('h3d-end');
    if (options.homePicker) {
      end.appendChild(options.homePicker);
    }
    END.forEach(function (key) {
      if (buttons[key]) {
        used[key] = true;
        decorate(buttons[key]);
        end.appendChild(buttons[key]);
      }
    });

    // More menu: listed sections, then any button not placed elsewhere
    var sections = MORE.map(function (keys) {
      return keys.filter(function (key) {
        return buttons[key] && !used[key] && (used[key] = true);
      });
    });
    sections.push(order.filter(function (key) {
      return !used[key];
    }));
    sections.forEach(function (keys) {
      if (keys.length === 0) {
        return;
      }
      if (menu.firstChild) {
        menu.appendChild(separator());
      }
      keys.forEach(function (key) {
        decorate(buttons[key]);
        menu.appendChild(buttons[key]);
      });
    });
    if (menu.firstChild) {
      menu.appendChild(separator());
    }
    tipsButton = document.createElement('button');
    tipsButton.className = 'toolbar-button h3d-tips-toggle';
    tipsButton.innerHTML = '<span class="h3d-ico"></span><span class="h3d-label">Drawing tips</span>';
    setMask(tipsButton.firstChild, iconUrl(mdiLightbulbOnOutline));
    tipsButton.classList.toggle('selected', hintsOn);
    tipsButton.addEventListener('click', function () {
      setHints(!hintsOn);
    });
    menu.appendChild(tipsButton);

    moreButton = document.createElement('button');
    moreButton.className = 'toolbar-button h3d-more-button';
    moreButton.title = 'More actions';
    moreButton.innerHTML = '<span class="h3d-ico"></span>';
    setMask(moreButton.firstChild, iconUrl(mdiDotsVertical));
    moreButton.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (menu.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    end.appendChild(moreButton);
    toolbar.appendChild(end);

    observer.takeRecords();
    layingOut = false;
    fitLabels();
    updateHint();
  }

  // Drops the drawing tools' text labels when the toolbar would overflow
  function fitLabels() {
    toolbar.classList.remove('h3d-compact');
    if (toolbar.scrollWidth > toolbar.clientWidth + 1) {
      toolbar.classList.add('h3d-compact');
    }
  }

  function separator() {
    var node = document.createElement('div');
    node.className = 'h3d-sep';
    return node;
  }

  /* ----------------------------- More menu ----------------------------- */

  function openMenu() {
    menu.classList.add('open');
    var rect = moreButton.getBoundingClientRect();
    var width = menu.offsetWidth;
    menu.style.left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) + 'px';
    if (rect.top > window.innerHeight / 2) {
      // Touch layout: the toolbar is at the bottom, open upwards
      menu.style.top = '';
      menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
      menu.style.bottom = '';
      menu.style.top = (rect.bottom + 4) + 'px';
    }
  }

  function closeMenu() {
    menu.classList.remove('open');
  }

  // Picking an item runs it (the engine's own click listener) and closes
  menu.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.toolbar-button') && !ev.target.closest('.h3d-tips-toggle')) {
      closeMenu();
    }
  });
  document.addEventListener('pointerdown', function (ev) {
    if (menu.classList.contains('open') && !menu.contains(ev.target)
        && !(moreButton && moreButton.contains(ev.target))) {
      closeMenu();
    }
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      closeMenu();
    }
  });
  window.addEventListener('resize', closeMenu);

  /* ---------------------------- drawing tips --------------------------- */

  function setHints(on) {
    hintsOn = on;
    try {
      window.localStorage.setItem(HINTS_KEY, on ? 'on' : 'off');
    } catch (e) {
      // storage unavailable: the choice just isn't remembered
    }
    if (tipsButton) {
      tipsButton.classList.toggle('selected', on);
    }
    updateHint();
  }

  function currentMode() {
    var selected = toolbar.querySelector('.toolbar-button.toggle.selected[id^="toolbar-button-CREATE_"],' +
      ' .toolbar-button.toggle.selected#toolbar-button-PAN');
    return selected ? keyOf(selected) : null;
  }

  function updateHint() {
    var text = hintsOn && HINTS[currentMode()];
    var plan = document.getElementById('home-plan');
    var rect = plan && plan.getBoundingClientRect();
    if (!text || !rect || rect.width < 200 || rect.height < 80) {
      hint.classList.remove('on');
      return;
    }
    if (hintText.textContent !== text) {
      hintText.textContent = text;
    }
    hint.style.maxWidth = (rect.width - 24) + 'px';
    hint.classList.add('on');
    hint.style.left = (rect.left + 12) + 'px';
    hint.style.top = (rect.bottom - hint.offsetHeight - 12) + 'px';
  }

  window.addEventListener('resize', function () {
    setTimeout(function () {
      fitLabels();
      updateHint();
    }, 0);
  });
  var plan = document.getElementById('home-plan');
  if (plan && window.ResizeObserver) {
    new ResizeObserver(updateHint).observe(plan);
  }

  /* ---------------------------- observation ---------------------------- */

  var relayout = null;

  function onToolbarChange(records) {
    if (layingOut) {
      return;
    }
    var rebuilt = false;
    var changed = [];
    records.forEach(function (record) {
      if (record.type === 'childList' && record.target === toolbar) {
        // The engine rebuilt its toolbar (another home was opened)
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType === 1 && !node.classList.contains('h3d-group')
              && !node.classList.contains('h3d-spacer')) {
            rebuilt = true;
          }
        });
      } else if (record.type === 'attributes' && record.target.classList
          && record.target.classList.contains('toolbar-button')) {
        changed.push(record.target);
      }
    });
    if (rebuilt) {
      clearTimeout(relayout);
      relayout = setTimeout(layout, 0);
      return;
    }
    changed.forEach(function (button) {
      if (button.id) {
        decorate(button);
      }
    });
    observer.takeRecords();
    updateHint();
  }

  var observer = new MutationObserver(onToolbarChange);
  var watch = { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'title'] };
  observer.observe(toolbar, watch);
  observer.observe(menu, watch);

  // Touch layouts' application menu button
  var applicationMenu = document.getElementById('application-menu-toolbar');
  if (applicationMenu) {
    Array.prototype.forEach.call(applicationMenu.querySelectorAll('.toolbar-button'), decorate);
  }

  /* ---------------------------- popup menus ---------------------------- */

  // Context menus show the engine's 16 px icons as <img>: swap in MDI icons
  function replaceMenuIcons(root) {
    var images = root.matches && root.matches('img.icon') ? [root] : root.querySelectorAll('.popup-menu img.icon');
    Array.prototype.forEach.call(images, function (image) {
      if (!image.closest('.popup-menu')) {
        return;
      }
      var path = ICONS[iconName(image.getAttribute('src'))];
      if (!path) {
        return;
      }
      var icon = document.createElement('span');
      icon.className = image.className + ' h3d-ico';
      setMask(icon, iconUrl(path));
      image.replaceWith(icon);
    });
  }

  replaceMenuIcons(document.body);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.addedNodes, function (node) {
        if (node.nodeType === 1 && (node.classList.contains('popup-menu') || node.closest('.popup-menu')
            || node.querySelector('.popup-menu'))) {
          replaceMenuIcons(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  /* ---------------------------- catalog search ------------------------- */

  var search = document.getElementById('furniture-search-field');
  if (search) {
    search.style.backgroundImage = iconUrl(mdiMagnify, '#9e9e9e');
  }

  layout();
}
