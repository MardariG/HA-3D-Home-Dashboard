/**
 * Several homes in the HA build.
 *
 * Homes are .sh3d files in <config>/home_3d_dashboard/, addressed by name
 * through the integration's API (DirectHomeRecorder). One of them is the
 * active home: the one the dashboard shows and the editor opens. The panel
 * stores it (home_3d_dashboard/set_active_home) when told over the bridge.
 *
 * - New asks for a name, then creates and saves an empty home under it;
 *   the previous home stays in the list (Open lists, opens and deletes).
 * - Saves go to the home's own name; Save as also copies the bindings.
 * - Opening, creating or renaming a home makes it the active one.
 * - The toolbar's home picker (createHomePicker) lists the homes to open
 *   one, and offers New and Delete.
 */

import { getAccessToken } from './haAuth.js';

// Same rule as the server (http.py _VALID_NAME, where \w is Unicode)
var VALID_NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_ .()-]{0,100}$/u;

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

/** Problem with a home name, or null when it can be used. */
export function homeNameProblem(name, existingNames) {
  if (!name) {
    return 'Enter a name.';
  }
  if (!VALID_NAME.test(name) || name.indexOf('..') >= 0) {
    return 'Use letters, numbers, spaces, dots, dashes, underscores or parentheses, '
      + 'starting with a letter or number (up to 100 characters).';
  }
  var lower = name.toLowerCase();
  for (var i = 0; i < existingNames.length; i++) {
    if (String(existingNames[i]).toLowerCase() === lower) {
      return 'A home named "' + existingNames[i] + '" already exists.';
    }
  }
  return null;
}

/**
 * Shows the "New home" dialog; calls onCreate(name) with a valid new name.
 * @param {string[]} existingNames
 */
function showNameDialog(existingNames, onCreate) {
  var overlay = el('div');
  overlay.id = 'h3d-home-dialog';
  var box = el('div', 'h3d-home-box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  var title = el('h2', null, 'New home');
  var hint = el('p', 'h3d-home-hint',
    'Your current home stays in your list of homes: switch back to it or delete it '
    + 'any time from the list of homes in the toolbar.');
  var label = el('label', null, 'Name');
  var input = el('input');
  input.type = 'text';
  input.maxLength = 101;
  input.placeholder = 'e.g. Beach house';
  input.setAttribute('autocomplete', 'off');
  label.appendChild(input);
  var error = el('p', 'h3d-home-error');
  var buttons = el('div', 'h3d-home-buttons');
  var cancel = el('button', null, 'Cancel');
  var create = el('button', 'primary', 'Create');
  buttons.appendChild(cancel);
  buttons.appendChild(create);
  [title, hint, label, error, buttons].forEach(function (node) {
    box.appendChild(node);
  });
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  function submit() {
    var name = input.value.trim();
    var problem = homeNameProblem(name, existingNames);
    if (problem) {
      error.textContent = problem;
      input.focus();
      return;
    }
    close();
    onCreate(name);
  }

  cancel.addEventListener('click', close);
  create.addEventListener('click', submit);
  input.addEventListener('input', function () {
    error.textContent = '';
  });
  // Keys stay in the dialog: the plan's shortcuts must not see them
  overlay.addEventListener('keydown', function (ev) {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      submit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  });
  overlay.addEventListener('pointerdown', function (ev) {
    if (ev.target === overlay) {
      close();
    }
  });
  setTimeout(function () {
    input.focus();
  }, 0);
}

/**
 * @param {SweetHome3DJSApplication} application
 * @param {Object} bridge from installEditorBindings
 */
export function installHomes(application, bridge) {
  var recorder = application.getHomeRecorder();

  // Name each home was opened or last saved under (Save as detection)
  var savedNames = typeof WeakMap === 'function' ? new WeakMap() : null;

  // Opening or creating a home makes it the active one
  application.addHomesListener(function (ev) {
    if (ev.getType() === window.CollectionEvent.Type.ADD && ev.getItem().getName()) {
      if (savedNames) {
        savedNames.set(ev.getItem(), ev.getItem().getName());
      }
      bridge.setActiveHome(ev.getItem().getName());
    }
  });

  var originalWriteHome = recorder.writeHome;
  recorder.writeHome = function (home, homeName, observer) {
    // The save worker reads the home zip over the authenticated API; it
    // picks the token up from the configuration it is instantiated with
    // (see the recorder-worker shim in webpack.config.js). Refresh it at
    // each save in case the frontend rotated its token meanwhile.
    this.configuration.__haAccessToken = getAccessToken();
    var homeSaved = observer && observer.homeSaved;
    var wrapped = Object.create(observer || {});
    wrapped.homeSaved = function () {
      var previous = savedNames ? savedNames.get(home) : null;
      if (previous && previous !== homeName) {
        // Saved as a new name: the copy keeps this home's bindings
        bridge.copyMappingsTo(homeName);
      }
      if (savedNames) {
        savedNames.set(home, homeName);
      }
      bridge.setActiveHome(homeName);
      if (homeSaved) {
        return homeSaved.apply(observer, arguments);
      }
    };
    return originalWriteHome.call(this, home, homeName, wrapped);
  };

  var Controller = window.DirectRecordingHomeController;
  if (typeof Controller !== 'function') {
    return;
  }

  /**
   * Lists the saved homes: onList(names), with [] when they can't be listed.
   * Used by the toolbar's home picker (createHomePicker below).
   */
  Controller.prototype.listHomes = function (onList) {
    var request = recorder.getAvailableHomes({
      availableHomes: function (names) {
        onList((names || []).filter(function (name) {
          return typeof name === 'string';
        }));
      },
      homesError: function () {
        onList([]);
      }
    });
    if (request == null) {
      onList([]);
    }
  };

  /**
   * Opens the home saved under `name` in place of this one, asking first to
   * save unsaved changes (like Open, without its dialog). Opening it makes
   * it the active home (homes listener above).
   */
  Controller.prototype.openHome = function (name) {
    var controller = this;
    var current = controller.home;
    if (!name || name === current.getName()) {
      return;
    }
    var read = function () {
      recorder.readHome(name, {
        homeLoaded: function (home) {
          home.setName(name);
          controller.close();
          application.addHome(home);
        },
        homeError: function (error) {
          console.log(error);
          alert('Couldn\'t open the home "' + name + '".\n' + error);
        },
        progression: function () {
        }
      });
    };
    if (current.isModified() || current.isRecovered()) {
      controller.getView().confirmSave(current.getName(), function (save) {
        if (save) {
          controller.save(read);
        } else {
          read();
        }
      });
    } else {
      read();
    }
  };

  // New: ask for a name, then create and save an empty home under it
  Controller.prototype.newHome = function () {
    var controller = this;
    var listed = function (names) {
      showNameDialog(names || [], function (name) {
        var create = function () {
          controller.close();
          var home = application.createHome();
          home.setName(name);
          application.addHome(home);
          // Saved right away, so it is in the list and the dashboard can open it
          application.getHomeController(home).save();
        };
        var home = controller.home;
        if (home.isModified() || home.isRecovered()) {
          controller.getView().confirmSave(home.getName(), function (save) {
            if (save) {
              controller.save(create);
            } else {
              create();
            }
          });
        } else {
          create();
        }
      });
    };
    var request = recorder.getAvailableHomes({
      availableHomes: listed,
      homesError: function () {
        // The server rejects nothing but invalid names; overwriting an
        // unlisted home is the worst case, so still offer the dialog.
        listed([]);
      }
    });
    if (request == null) {
      listed([]);
    }
  };
}

var NEW_HOME = '\u0000new';
var DELETE_HOMES = '\u0000delete';

/**
 * The toolbar's home picker (HA build, after installHomes): a list of the
 * saved homes, the open one selected; picking another opens it (asking to
 * save unsaved changes first). Its last entries create a new home and
 * open the list of homes to delete some. Returns the <select>, or null
 * outside the HA build.
 * @param {SweetHome3DJSApplication} application
 */
export function createHomePicker(application) {
  var Controller = window.DirectRecordingHomeController;
  if (typeof Controller !== 'function' || typeof Controller.prototype.openHome !== 'function') {
    return null;
  }
  var names = [];
  var select = el('select', 'h3d-home-picker');
  select.title = 'Your homes: pick one to open it. The dashboard shows the home open here.';
  select.setAttribute('aria-label', 'Home');

  function controller() {
    var home = application.getHomes()[0];
    return home ? application.getHomeController(home) : null;
  }

  function currentName() {
    var home = application.getHomes()[0];
    return (home && home.getName()) || '';
  }

  function option(value, text, disabled) {
    var node = el('option', null, text);
    node.value = value;
    node.disabled = !!disabled;
    return node;
  }

  function fill() {
    var current = currentName();
    var listed = names.slice();
    if (listed.indexOf(current) < 0) {
      listed.unshift(current);
    }
    var key = listed.join('\n') + '\n\n' + current;
    if (select.getAttribute('data-key') === key) {
      select.value = current;
      return;
    }
    select.setAttribute('data-key', key);
    select.textContent = '';
    listed.forEach(function (name) {
      select.appendChild(option(name, '🏠 ' + (name || 'Untitled')));
    });
    select.appendChild(option('', '──────────', true));
    select.appendChild(option(NEW_HOME, '＋ New home…'));
    select.appendChild(option(DELETE_HOMES, 'Delete homes…'));
    select.value = current;
  }

  function refresh() {
    var homeController = controller();
    if (homeController) {
      homeController.listHomes(function (list) {
        names = list;
        fill();
      });
    }
  }

  select.addEventListener('focus', refresh);
  select.addEventListener('change', function () {
    var value = select.value;
    // Stays on the open home until another one has opened (or if a
    // question on the way is cancelled)
    select.value = currentName();
    var homeController = controller();
    if (!homeController) {
      return;
    }
    if (value === NEW_HOME) {
      homeController.newHome();
    } else if (value === DELETE_HOMES) {
      homeController.open();
    } else {
      homeController.openHome(value);
    }
  });
  // Keys stay in the list: the plan's shortcuts must not see them
  select.addEventListener('keydown', function (ev) {
    ev.stopPropagation();
  });

  application.addHomesListener(function (ev) {
    if (ev.getType() === window.CollectionEvent.Type.ADD) {
      refresh();
    }
  });
  // Save as renames the open home
  var recorder = application.getHomeRecorder();
  var writeHome = recorder.writeHome;
  recorder.writeHome = function (home, homeName, observer) {
    var wrapped = Object.create(observer || {});
    wrapped.homeSaved = function () {
      setTimeout(refresh, 0);
      if (observer && observer.homeSaved) {
        return observer.homeSaved.apply(observer, arguments);
      }
    };
    return writeHome.call(this, home, homeName, wrapped);
  };
  refresh();
  return select;
}
