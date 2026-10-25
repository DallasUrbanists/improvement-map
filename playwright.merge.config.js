import { defineConfig } from '@playwright/test';

// Container and host jobs have different absolute checkout paths. All producer
// configs share this test root, so relative source paths survive relocation.
export default defineConfig({ testDir: './tests' });
