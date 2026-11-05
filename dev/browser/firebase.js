import { computed, ref } from 'vue';

const user = ref(null), ready = ref(true), claimsReady = ref(true), error = ref(''), authVersion = ref(0);
const unavailable = async () => { error.value = 'Account sign-in is not exposed in this local sandbox.'; return null; };
export function useAuth() {
  return {
    user, ready, claimsReady, error, authVersion, configured: true,
    initials: computed(() => '?'), isStaff: computed(() => false),
    waitForReady: async () => {}, getToken: async () => null, getAppCheckToken: async () => null,
    signIn: unavailable, register: unavailable, signInWithGoogle: unavailable,
    signOut: async () => { user.value = null; authVersion.value++; },
  };
}
