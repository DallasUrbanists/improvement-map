// Shared API origin kept separate so capability-based clients can avoid the
// Firebase/App Check helpers in api.js.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'https://api.dallasurbanists.org';
