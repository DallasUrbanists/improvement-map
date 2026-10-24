import { useAuth as useLiveAuth } from 'virtual:local-firebase-live';
import { useAuth as useMockAuth } from './firebase.js?local-mock';

export function useAuth() {
  const live = useLiveAuth();
  const identity = __LOCAL_DEPENDENCY_MODES__.auth === 'live' ? live : useMockAuth();
  return {
    ...identity,
    getAppCheckToken: __LOCAL_DEPENDENCY_MODES__.appcheck === 'live' ? live.getAppCheckToken : async () => null,
  };
}
