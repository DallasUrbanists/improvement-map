let scroll = 0;
let theme = 'system';
export const getStoredBrowseListScroll = () => scroll;
export const setStoredBrowseListScroll = value => { scroll = value; };
export const getStoredTheme = () => theme;
export const setStoredTheme = value => { theme = value; };
export const resetStorage = () => { scroll = 0; theme = 'system'; };
