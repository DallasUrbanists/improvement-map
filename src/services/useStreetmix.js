import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from './firebase';
import { canReplaceStreetmix, readStreetmixOperation, saveStreetmixOperation, safeStreetmixUrl, streetmixPath, streetmixRequest } from './streetmix';

const activeStatuses = ['generating', 'publishing', 'save_pending'];
export function useStreetmix(props, emit, open) {
  const { user, isStaff } = useAuth();
  const saved = ref(null), result = ref(null), workflow = ref(null), pending = ref(null);
  const loading = ref(false), busy = ref(false), error = ref(''), storageNotice = ref(''), etag = ref(null), retryAt = ref(0), now = ref(Date.now());
  let version = 0, controller, timer, clock, attempts = 0, expiredRequest = null;
  const base = () => streetmixPath(props.suggestion.id);
  const authorized = computed(() => canReplaceStreetmix(props.suggestion, user.value, isStaff.value));
  const regeneration = computed(() => pending.value?.regeneration ?? Boolean(workflow.value && (saved.value || workflow.value.type === 'regenerate' || workflow.value.operation === 'regenerate')));
  const selectionAllowed = computed(() => !regeneration.value || authorized.value);
  const url = computed(() => safeStreetmixUrl(result.value?.streetmixUrl));
  const expired = computed(() => workflow.value?.status === 'expired' || (workflow.value?.status === 'awaiting_selection' && workflow.value.selectionExpiresAt && Date.parse(workflow.value.selectionExpiresAt) <= now.value));
  const selecting = computed(() => workflow.value?.status === 'awaiting_selection' && !expired.value);
  const active = computed(() => activeStatuses.includes(workflow.value?.status));
  const blocked = computed(() => busy.value || loading.value || now.value < retryAt.value);
  const statusMessage = computed(() => ({ generating: saved.value ? 'Updating design… About a minute.' : 'Creating design… About a minute.', publishing: 'Publishing design…', save_pending: 'Resume to finish saving.', publication_uncertain: 'The design may already be published.', failed: 'Design creation stopped.', completed: 'Design saved.' }[workflow.value?.status] || ''));

  function persist(op) {
    pending.value = op;
    try { saveStreetmixOperation(props.suggestion.id, op); storageNotice.value = ''; }
    catch { storageNotice.value = 'Recovery could not be saved on this device. Keep this view open.'; }
  }
  function stop() { clearTimeout(timer); controller?.abort(); version++; }
  function schedule() {
    clearTimeout(timer);
    if (!open.value || !active.value || attempts >= 8 || !workflow.value?.requestId) return;
    timer = setTimeout(check, Math.max(retryAt.value - Date.now(), Math.min(30000, 2000 * 2 ** attempts++)));
  }
  async function request(path, operation) {
    const generation = version;
    const response = await streetmixRequest(path, { operation, signal: controller.signal });
    if (generation !== version) return null;
    if (response.retryMs) retryAt.value = Date.now() + response.retryMs;
    return response;
  }
  function fail(response) {
    const messages = { 401: regeneration.value ? 'Verification or sign-in failed. Please try again.' : 'Application verification failed. Please try again.', 403: 'You cannot replace this design.', 412: 'The design changed. Review the latest design.', 428: 'Reload the design before regenerating.', 422: 'This location cannot be used for Streetmix.', 429: 'Too many requests. Try again shortly.' };
    error.value = (response.status === 401 ? messages[401] : response.body?.message) || messages[response.status] || response.body?.error || `Streetmix unavailable (HTTP ${response.status}).`;
  }
  async function reconcile(completed = false) {
    const response = await request(base());
    if (!response) return false;
    if (response.status !== 200) { fail(response); return false; }
    etag.value = response.etag;
    saved.value = response.body.streetmix;
    result.value = response.body.result;
    emit('saved', response.body.streetmix);
    workflow.value = response.body.activeRequest || null;
    // A visible saved design may predate a lost regeneration response. Only
    // retire the descriptor after a completion receipt has been reconciled.
    if (completed) persist(null);
    if (workflow.value?.status === 'completed') { persist(null); workflow.value = null; }
    if (!workflow.value && pending.value?.requestId) workflow.value = { requestId: pending.value.requestId, status: 'interrupted' };
    schedule();
    return true;
  }
  async function consume(response) {
    if (!response) return;
    const body = response.body;
    if ((response.status >= 200 && response.status < 300) || ['publication_uncertain', 'save_pending', 'failed', 'expired'].includes(body.status) || (response.status === 409 && body.error === 'STREET_SELECTION_REQUIRED')) {
      workflow.value = body;
      if (body.status === 'failed' && body.message) error.value = body.message;
      if (pending.value && body.requestId) persist({ ...pending.value, requestId: body.requestId });
      if (body.status === 'completed') { await reconcile(true); return; }
      if (body.status === 'expired') {
        await reconcile();
        if (!workflow.value || workflow.value.status === 'interrupted') workflow.value = { ...body, status: 'expired' };
        return;
      }
      schedule();
    } else {
      if (workflow.value?.status !== 'publication_uncertain') workflow.value = { requestId: pending.value?.requestId || workflow.value?.requestId, status: 'interrupted' };
      fail(response);
      if ([403, 409, 412, 428].includes(response.status)) {
        if ([403, 412, 428].includes(response.status)) persist(null);
        await reconcile();
      }
    }
  }
  async function load() {
    stop(); controller = new AbortController(); attempts = 0;
    const generation = version;
    loading.value = true; busy.value = false; error.value = '';
    try { await reconcile(); }
    catch (e) { if (generation === version) error.value = 'Unable to load Streetmix. Please try again.'; }
    finally { if (generation === version) loading.value = false; }
  }
  async function check() {
    if (busy.value || loading.value || Date.now() < retryAt.value || !workflow.value?.requestId) return;
    const generation = version;
    busy.value = true; error.value = '';
    try { await consume(await request(`${base()}/requests/${encodeURIComponent(workflow.value.requestId)}`)); }
    catch { if (generation === version) error.value = 'Unable to check status. Please try again.'; }
    finally { if (generation === version) busy.value = false; }
  }
  async function send(op) {
    persist(op);
    const generation = version;
    try { await consume(await request(op.path, op)); }
    catch {
      if (generation === version) {
        if (workflow.value?.status !== 'publication_uncertain') workflow.value = { requestId: pending.value?.requestId || workflow.value?.requestId, status: 'interrupted' };
        error.value = 'Connection interrupted. Resume to recover this request.';
      }
    }
  }
  async function start(replace = false) {
    if (blocked.value || (replace && !authorized.value) || (pending.value && !expired.value && workflow.value?.status !== 'failed')) return;
    busy.value = true; error.value = ''; clearTimeout(timer);
    const generation = version;
    try {
      if (expired.value || workflow.value?.status === 'failed') persist(null);
      if (replace) {
        const refreshed = await reconcile();
        if (!refreshed || generation !== version) return;
        if (!etag.value) { error.value = 'The server did not provide a design version. Reload before regenerating.'; return; }
        if (workflow.value && !['expired', 'failed'].includes(workflow.value.status)) return;
        if (!authorized.value) { error.value = 'Only the author or staff can regenerate this design.'; return; }
      }
      const op = { suggestionId: props.suggestion.id, path: base() + (replace ? '/regenerate' : ''), body: '{}', key: crypto.randomUUID(), regeneration: replace, ...(replace ? { etag: etag.value } : {}) };
      workflow.value = { status: 'generating' }; attempts = 0;
      await send(op);
    } catch { if (generation === version) error.value = 'Unable to start Streetmix. Please try again.'; }
    finally { if (generation === version) busy.value = false; }
  }
  async function resume() {
    if (blocked.value || !pending.value || (regeneration.value && !authorized.value)) return;
    const generation = version;
    busy.value = true; error.value = ''; attempts = 0;
    try { await send(pending.value); }
    finally { if (generation === version) busy.value = false; }
  }
  async function confirm(osmWayId) {
    if (blocked.value || !selecting.value || !selectionAllowed.value) return;
    const generation = version;
    busy.value = true; error.value = ''; attempts = 0;
    const path = `${base()}/requests/${encodeURIComponent(workflow.value.requestId)}/selection`;
    // A retry of confirmation must never create a new phase key.
    const op = pending.value?.path === path ? pending.value : { suggestionId: props.suggestion.id, path, body: JSON.stringify({ osmWayId }), key: crypto.randomUUID(), requestId: workflow.value.requestId, regeneration: regeneration.value, etag: pending.value?.etag };
    try { await send(op); }
    finally { if (generation === version) busy.value = false; }
  }
  watch(() => [props.suggestion.id, props.refreshVersion], () => {
    saved.value = result.value = workflow.value = null; busy.value = false; retryAt.value = 0; expiredRequest = null;
    pending.value = readStreetmixOperation(props.suggestion.id);
    load();
  }, { immediate: true });
  watch(open, value => { if (value) { attempts = 0; load(); } else stop(); });
  clock = setInterval(() => { now.value = Date.now(); }, 1000);
  watch(expired, value => {
    const id = workflow.value?.requestId;
    if (value && id && expiredRequest !== id) {
      expiredRequest = id;
      const loading = load(), generation = version;
      loading.then(() => {
        if (generation === version && (!workflow.value || workflow.value.status === 'interrupted')) workflow.value = { requestId: id, status: 'expired' };
      });
    }
  });
  onBeforeUnmount(() => { stop(); clearInterval(clock); });
  return { saved, result, workflow, pending, loading, busy, error, storageNotice, authorized, selectionAllowed, regeneration, url, expired, selecting, active, blocked, statusMessage, load, check, start, resume, confirm };
}
