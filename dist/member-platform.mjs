import { initLocalization } from './games/spinrealm/i18n.mjs';
import { initMemberUI } from './games/spinrealm/member-ui.mjs';
import { subscribeMember } from './games/spinrealm/member-client.mjs';
initLocalization();
initMemberUI({mount:document.querySelector('.site-header')});
const playerCenter = document.querySelector('#playerCenterLink');
if (playerCenter) subscribeMember(({user}) => { playerCenter.hidden = !user; });
