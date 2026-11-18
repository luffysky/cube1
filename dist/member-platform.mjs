import { initLocalization } from './games/spinrealm/i18n.mjs';
import { initMemberUI } from './games/spinrealm/member-ui.mjs';
initLocalization();
initMemberUI({mount:document.querySelector('.site-header')});
