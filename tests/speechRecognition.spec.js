import { test, expect } from '@playwright/test';
import { createSpeechRecorder } from '../src/services/speechRecognition.js';

function harness({ shortSessions = false, unsupported = false } = {}) {
  let timestamp = 0;
  let timerId = 0;
  const timers = new Map();
  const recognizers = [];
  const states = [];
  const errors = [];
  const texts = [];
  class Recognition {
    constructor() {
      recognizers.push(this);
      this.stops = 0;
      this.aborts = 0;
    }
    start() {}
    stop() { this.stops += 1; }
    abort() { this.aborts += 1; }
  }
  const recorder = createSpeechRecorder({
    getRecognition: () => unsupported ? undefined : Recognition,
    useShortSessions: () => shortSessions,
    onState: (state) => states.push(state),
    onError: (error) => errors.push(error),
    onText: (text) => texts.push(text),
    schedule: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, time: timestamp + delay });
      return id;
    },
    cancelTimer: (id) => timers.delete(id),
    now: () => timestamp,
  });
  function advance(milliseconds) {
    const end = timestamp + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.time <= end)
        .sort(([, a], [, b]) => a.time - b.time)[0];
      if (!next) break;
      timestamp = next[1].time;
      timers.delete(next[0]);
      next[1].callback();
    }
    timestamp = end;
  }
  return { recorder, Recognition, recognizers, states, errors, texts, timers, advance };
}

function results(recognizer, entries, resultIndex = 0) {
  recognizer.onresult({
    resultIndex,
    results: entries.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
  });
}

test('speech controller waits for confirmed start and times out a stalled startup', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('Existing text');
  expect(h.states.at(-1)).toBe('starting');
  h.advance(15000);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.errors.at(-1)).toContain('did not start');
  expect(h.recognizers[0].aborts).toBe(1);
  expect(h.timers.size).toBe(0);
});

test('speech controller cancels pending permission and ignores late events', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('Original');
  const old = h.recognizers[0];
  const lateStart = old.onstart;
  const lateResult = old.onresult;
  h.recorder.stop();
  h.recorder.start('New text');
  lateStart();
  lateResult({ results: [[{ transcript: 'stale transcript' }]] });
  expect(h.states.at(-1)).toBe('starting');
  expect(h.texts).toEqual([]);
  expect(old.aborts).toBe(1);
  h.recorder.cancel();
});

test('speech controller replaces interims and commits each final index once', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('Original');
  const recognizer = h.recognizers[0];
  recognizer.onstart();
  expect(h.states.at(-1)).toBe('listening');
  results(recognizer, [['repair the', false]]);
  results(recognizer, [['repair the crossing', false]]);
  expect(h.texts.at(-1)).toBe('Original\nrepair the crossing');
  results(recognizer, [['repair the crossing', true]]);
  for (let i = 0; i < 6; i++) results(recognizer, [['repair the crossing', true]]);
  expect(h.texts.at(-1)).toBe('Original\nrepair the crossing');
  expect(h.texts).toHaveLength(2);
  results(recognizer, [['repair the crossing', true], ['near school', false]], 1);
  results(recognizer, [['repair the crossing', true], ['near the library', true]], 1);
  expect(h.texts.at(-1)).toBe('Original\nrepair the crossing near the library');
  h.recorder.cancel();
});

test('speech controller removes withdrawn interims without removing deliberate repetitions', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  const recognizer = h.recognizers[0];
  recognizer.onstart();
  results(recognizer, [['very', true], ['very', true], ['unsafe', false]]);
  results(recognizer, [['very', true], ['very', true]], 2);
  expect(h.texts.at(-1)).toBe('very very');
  h.recorder.cancel();
});

test('speech controller waits for last results after Stop and force-aborts a stalled stop', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  const recognizer = h.recognizers[0];
  recognizer.onstart();
  results(recognizer, [['Make it', false]]);
  h.recorder.stop();
  expect(h.states.at(-1)).toBe('stopping');
  results(recognizer, [['Make it safe', true]]);
  h.advance(1500);
  expect(h.texts.at(-1)).toBe('Make it safe');
  expect(recognizer.stops).toBe(1);
  expect(recognizer.aborts).toBe(1);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.timers.size).toBe(0);
});

test('speech controller restarts Android short sessions without duplicating earlier text', { tag: '@unit' }, () => {
  const h = harness({ shortSessions: true });
  h.recorder.start('Original');
  const first = h.recognizers[0];
  expect(first.continuous).toBe(false);
  first.onstart();
  results(first, [['First sentence.', true]]);
  const staleEnd = first.onend;
  first.onend();
  expect(h.states.at(-1)).toBe('starting');
  h.advance(750);
  const second = h.recognizers[1];
  second.onstart();
  staleEnd();
  expect(h.states.at(-1)).toBe('listening');
  results(second, [['Second sentence.', true]]);
  expect(h.texts.at(-1)).toBe('Original\nFirst sentence. Second sentence.');
  h.recorder.stop();
  second.onend();
  h.advance(750);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.recognizers).toHaveLength(2);
});

test('speech controller can cancel during the restart delay', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  const first = h.recognizers[0];
  expect(first.continuous).toBe(true);
  first.onstart();
  results(first, [['Complete.', true]]);
  first.onend();
  h.recorder.stop();
  h.advance(750);
  expect(h.recognizers).toHaveLength(1);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.texts.at(-1)).toBe('Complete.');
});

test('speech controller stops repeated empty sessions rather than looping forever', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  for (let i = 0; i < 3; i++) {
    h.recognizers[i].onstart();
    h.recognizers[i].onend();
    h.advance(750);
  }
  expect(h.recognizers).toHaveLength(3);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.errors.at(-1)).toContain('without a final result');
  expect(h.timers.size).toBe(0);
});

test('speech controller bounds restart frequency even with final results', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  for (let i = 0; i < 11; i++) {
    const recognizer = h.recognizers[i];
    recognizer.onstart();
    results(recognizer, [['Short.', true]]);
    recognizer.onend();
    h.advance(750);
  }
  expect(h.states.at(-1)).toBe('idle');
  expect(h.errors.at(-1)).toContain('restarting too often');
  expect(h.recognizers).toHaveLength(11);
});

for (const error of ['not-allowed', 'network', 'no-speech', 'audio-capture']) {
  test(`speech controller stops on ${error} without restarting`, { tag: '@unit' }, () => {
    const h = harness();
    h.recorder.start('');
    h.recognizers[0].onerror({ error });
    h.advance(60000);
    expect(h.states.at(-1)).toBe('idle');
    expect(h.errors.at(-1)).not.toBe('');
    expect(h.recognizers).toHaveLength(1);
    expect(h.timers.size).toBe(0);
  });
}

test('speech controller detects a started recognizer that never delivers text', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  h.recognizers[0].onstart();
  h.advance(30000);
  expect(h.states.at(-1)).toBe('idle');
  expect(h.errors.at(-1)).toContain('No speech results');
  expect(h.recognizers[0].aborts).toBe(1);
});

test('speech controller preserves pending text on an incomplete natural end', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('');
  h.recognizers[0].onstart();
  results(h.recognizers[0], [['Final sentence.', true], ['unfinished', false]]);
  h.recognizers[0].onend();
  expect(h.texts.at(-1)).toBe('Final sentence. unfinished');
  expect(h.states.at(-1)).toBe('idle');
  expect(h.recognizers).toHaveLength(1);
});

test('speech controller diagnostics never include source text or transcripts', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('Private source text');
  h.recognizers[0].onstart();
  results(h.recognizers[0], [['Private spoken text', true]]);
  h.recorder.cancel();
  const diagnostics = h.recorder.getDiagnostics();
  expect(diagnostics.some((event) => event.event === 'result')).toBe(true);
  expect(JSON.stringify(diagnostics)).not.toContain('Private');
  expect(diagnostics.every((event) => Object.keys(event).every((key) =>
    ['timestamp', 'sessionId', 'event', 'error'].includes(key)))).toBe(true);
});

test('speech controller ignores rapid duplicate starts and recovers from thrown start/stop calls', { tag: '@unit' }, () => {
  const h = harness();
  h.recorder.start('Original');
  h.recorder.start('Ignored');
  expect(h.recognizers).toHaveLength(1);
  const recognizer = h.recognizers[0];
  recognizer.onstart();
  recognizer.stop = () => { throw new Error('Already stopped'); };
  h.recorder.stop();
  expect(h.states.at(-1)).toBe('idle');
  h.Recognition.prototype.start = () => { throw new Error('Start unavailable'); };
  h.recorder.start('Restarted');
  expect(h.states.at(-1)).toBe('idle');
  expect(h.errors.at(-1)).toContain('Could not start');
  expect(h.timers.size).toBe(0);
});

test('speech UI can cancel startup and abort recording when its cached view is left', async ({ page }) => {
  await page.addInitScript(() => {
    window.speechSessions = [];
    class Recognition {
      constructor() { window.speechSessions.push(this); }
      start() {}
      stop() {}
      abort() { this.aborted = true; }
    }
    window.SpeechRecognition = Recognition;
  });
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 3, details: '', photos: [], location: { latitude: 32.78, longitude: -96.8, address: 'Dallas, TX' } })));
  await page.goto('/submit');
  await page.locator('#input-details').fill('Original draft content');
  await page.getByRole('button', { name: /Record$/ }).click();
  await expect(page.getByRole('button', { name: 'Cancel recording' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel recording' }).click();
  expect(await page.evaluate(() => window.speechSessions[0].aborted)).toBe(true);
  await page.getByRole('button', { name: /Record$/ }).click();
  await page.evaluate(() => {
    const session = window.speechSessions[1];
    session.onstart();
    window.lateSpeechResult = session.onresult;
  });
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.speechSessions[1].aborted)).toBe(true);
  await page.evaluate(() => window.lateSpeechResult({ results: [[{ transcript: 'Must be ignored' }]] }));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByTestId('pin-and-continue').click();
  await page.getByRole('button', { name: 'Skip photos', exact: true }).click();
  await expect(page.locator('#input-details')).toHaveValue('Original draft content');
  await expect(page.getByRole('button', { name: /Record$/ })).toBeVisible();
});

test('speech UI says Please wait during an automatic restart and resumes listening', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    class Recognition {
      start() { window.recognizer = this; this.onstart(); }
      stop() { this.onend?.(); }
      abort() {}
    }
    window.SpeechRecognition = Recognition;
  });
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 3, details: '', photos: [], location: { latitude: 32.78, longitude: -96.8, address: 'Dallas, TX' } })));
  await page.goto('/submit');
  await page.getByRole('button', { name: 'Record speech to text' }).click();
  await page.evaluate(() => {
    window.recognizer.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: 'A complete sentence.' }], { isFinal: true })],
    });
    window.recognizer.onend();
  });
  await expect(page.getByRole('button', { name: 'Please wait' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Resuming recording… Please wait.');
  await expect(page.getByRole('button', { name: 'Cancel recording' })).toHaveCount(0);
  await page.clock.runFor(750);
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.locator('#input-details')).toHaveValue('A complete sentence.');
});

test('speech UI recovers from a stalled stop and cancels when the page is hidden', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    class Recognition {
      start() { window.recognizer = this; this.onstart(); }
      stop() {}
      abort() { this.aborted = true; }
    }
    window.SpeechRecognition = Recognition;
  });
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 3, details: '', photos: [], location: { latitude: 32.78, longitude: -96.8, address: 'Dallas, TX' } })));
  await page.goto('/submit');
  await page.getByRole('button', { name: 'Record speech to text' }).click();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  await page.clock.runFor(1600);
  await expect(page.getByRole('button', { name: 'Record speech to text' })).toBeEnabled();
  expect(await page.evaluate(() => window.recognizer.aborted)).toBe(true);

  await page.getByRole('button', { name: 'Record speech to text' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Record speech to text' })).toBeEnabled();
  expect(await page.evaluate(() => window.recognizer.aborted)).toBe(true);
});

test('speech controller offers a keyboard fallback when the API is unavailable', { tag: '@unit' }, () => {
  const h = harness({ unsupported: true });
  h.recorder.start('');
  expect(h.errors.at(-1)).toContain('keyboard microphone');
  expect(h.recognizers).toHaveLength(0);
});
