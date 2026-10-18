import { ref, shallowRef } from 'vue';

// Compatibility handle for the single map owned by MapWorkspace, never a route view.
export const sharedBrowseMap = shallowRef(null);
export const browseMapInitialization = ref('not-started');
