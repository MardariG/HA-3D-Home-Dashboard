/**
 * What the dashboard and editor tell the user when they can't show a home
 * (HA build): the wording and actions for each case, shown with
 * src/haMode.js showMessageCard.
 */

import {
  mdiAlertCircleOutline, mdiHomePlusOutline, mdiHomeSearchOutline,
  mdiLinkVariantOff, mdiLockAlertOutline
} from '@mdi/js';
import { showMessageCard } from './haMode.js';

function reloadPanel() {
  // The whole Home Assistant page: it signs in again, then reloads this one
  try {
    window.top.location.reload();
  } catch (e) {
    window.location.reload();
  }
}

/** Dashboard: the active home doesn't exist (yet). */
export function showNoHome(homeName, editorHref) {
  if (homeName === 'default') {
    showMessageCard({
      icon: mdiHomePlusOutline,
      title: 'Let\'s build your home',
      text: 'There\'s no 3D home to show yet. Open the editor to draw your walls and rooms, '
        + 'add furniture, and link your lights and sensors.',
      actions: [{ label: 'Create your home', href: editorHref, primary: true }]
    });
  } else {
    showMessageCard({
      icon: mdiHomeSearchOutline,
      title: 'Home "' + homeName + '" wasn\'t found',
      text: 'It may have been deleted or renamed. Open the editor to pick one of your homes '
        + 'or create a new one.',
      actions: [{ label: 'Open the editor', href: editorHref, primary: true }]
    });
  }
}

/** The API refused the sign-in, even with a renewed access token. */
export function showSignInRefused(details) {
  showMessageCard({
    icon: mdiLockAlertOutline,
    title: 'Couldn\'t sign in to Home Assistant',
    text: 'Home Assistant didn\'t accept the dashboard\'s sign-in, probably because it expired. '
      + 'Reload the page to sign in again.',
    details: details,
    actions: [{ label: 'Reload', onClick: reloadPanel, primary: true }]
  });
}

/** Any other failure to load or show the home. */
export function showLoadFailed(homeName, details, extraActions) {
  showMessageCard({
    icon: mdiAlertCircleOutline,
    title: 'Couldn\'t load your home',
    text: 'Something went wrong while loading "' + homeName + '". Check that Home Assistant '
      + 'is running, then try again.',
    details: details,
    actions: [{ label: 'Try again', onClick: function () { window.location.reload(); }, primary: true }]
      .concat(extraActions || [])
  });
}

/** The page was opened outside the 3D Dashboard panel. */
export function showNotInPanel() {
  showMessageCard({
    icon: mdiLinkVariantOff,
    title: 'Open the 3D Dashboard from Home Assistant',
    text: 'This page only works inside Home Assistant: open 3D Dashboard in the sidebar.'
  });
}
