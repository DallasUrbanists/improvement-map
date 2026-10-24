// Shared API origin kept separate so capability-based clients can avoid the
// Firebase/App Check helpers in api.js.
import { resolveApiBaseUrl } from './stagingOrigin.js';

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env);
