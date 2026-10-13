import { ref, shallowRef } from 'vue';

export const sharedBrowseMap = shallowRef(null);
export const browseMapInitialization = ref('not-started');
