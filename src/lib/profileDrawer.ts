export type ProfileDrawerTab = 'profile' | 'password' | 'payment' | 'notifications';

export const PROFILE_DRAWER_EVENT = 'leimberg:open-profile';

export function openProfileDrawer(tab: ProfileDrawerTab = 'profile') {
  window.dispatchEvent(new CustomEvent(PROFILE_DRAWER_EVENT, { detail: { tab } }));
}
