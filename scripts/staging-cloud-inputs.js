import { pathToFileURL } from 'node:url';
import { stagingOrigin } from '../src/services/stagingOrigin.js';

export function validateCloudInputs(env) {
  stagingOrigin(env.STAGING_API_ORIGIN);
  if (env.GCP_PROJECT_ID !== 'urbanists-mixer-slides-helper') throw new Error('Incorrect staging GCP_PROJECT_ID.');
  if (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[^/\s]+\/providers\/[^/\s]+$/.test(env.GCP_WORKLOAD_IDENTITY_PROVIDER || '')) {
    throw new Error('Missing or invalid receipt GCP_WORKLOAD_IDENTITY_PROVIDER.');
  }
  if (env.GCP_SERVICE_ACCOUNT !== 'map-staging-deployer@urbanists-mixer-slides-helper.iam.gserviceaccount.com') {
    throw new Error('Missing or incorrect receipt GCP_SERVICE_ACCOUNT.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { validateCloudInputs(process.env); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
