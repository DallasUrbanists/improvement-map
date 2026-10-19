import { ref } from 'vue';
import { compareVersions, versionParts } from './releaseVersions.js';
export const ANNOUNCEMENT_KEY = 'improvement_map_announcements_v1';
export const WELCOME_SESSION_KEY = 'improvement_map_welcome_session_v1';
export const announcementRequest = ref(null);
export function openAnnouncement(screen) { announcementRequest.value = { screen, nonce: Date.now() }; }

export function createAnnouncementStore(storage, session) {
  let memory = { version: 1, skipWelcome: false, acknowledged: null, initialized: false };
  let sessionSeen = false;
  let storageFailed = false;
  const notice = ref('');
  function read() {
    if (storageFailed) return { ...memory };
    try {
      const raw = storage.getItem(ANNOUNCEMENT_KEY);
      if (!raw) memory = { version: 1, skipWelcome: false, acknowledged: null, initialized: false };
      else {
        const value = JSON.parse(raw);
        if (value.version !== 1 || typeof value.skipWelcome !== 'boolean' || typeof value.initialized !== 'boolean' || (value.acknowledged !== null && !versionParts(value.acknowledged))) throw Error();
        memory = value;
      }
    } catch { storageFailed = true; notice.value = 'Preferences cannot be remembered in this browser. You can still use the app.'; }
    return { ...memory };
  }
  function write(change) {
    memory = { ...read(), ...change };
    try { storage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(memory)); }
    catch { storageFailed = true; notice.value = 'Preferences cannot be remembered in this browser. You can still use the app.'; }
  }
  return {
    notice, read,
    initialize(latest) { if (!read().initialized) write({ initialized: true, acknowledged: latest || null }); },
    skip(value) { write({ skipWelcome: value }); },
    acknowledge(version) { const old = read().acknowledged; if (version && (!old || compareVersions(version, old) > 0)) write({ acknowledged: version }); },
    welcomeSeen() { try { sessionSeen ||= session.getItem(WELCOME_SESSION_KEY) === '1'; } catch { notice.value = 'Preferences cannot be remembered in this browser. You can still use the app.'; } return sessionSeen; },
    markWelcomeSeen() { sessionSeen = true; try { session.setItem(WELCOME_SESSION_KEY, '1'); } catch { notice.value = 'Preferences cannot be remembered in this browser. You can still use the app.'; } },
    resetSession() { sessionSeen = false; try { session.removeItem(WELCOME_SESSION_KEY); } catch { /* memory fallback */ } },
  };
}
