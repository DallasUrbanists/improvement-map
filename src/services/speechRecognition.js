const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.',
  'service-not-allowed': 'Speech recognition is unavailable in this browser.',
  'audio-capture': 'No microphone was found. Connect or enable a microphone, then try again.',
  network: 'Speech recognition could not connect. Check your internet connection, then try again.',
  'no-speech': 'No speech was detected. Try speaking closer to your microphone.',
  'language-not-supported': 'English (US) speech recognition is not supported by this browser.',
};

export function createSpeechRecorder({
  onText,
  onState,
  onError,
  onDiagnostic = () => {},
  getRecognition = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
  useShortSessions = () => /Android/i.test(globalThis.navigator?.userAgent || ''),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancelTimer = (timer) => clearTimeout(timer),
  now = () => Date.now(),
  startupTimeout = 15000,
  stopTimeout = 1500,
  resultTimeout = 30000,
  restartDelay = 750,
} = {}) {
  let state = 'idle';
  let run = null;
  let session = null;
  let nextId = 0;
  const diagnostics = [];

  function report(event, target = session, error) {
    const entry = { timestamp: now(), sessionId: target?.id ?? null, event };
    if (error) entry.error = error;
    diagnostics.push(entry);
    if (diagnostics.length > 100) diagnostics.shift();
    onDiagnostic(entry);
  }

  function setState(value) {
    state = value;
    onState(value);
  }

  function isCurrent(target) {
    return session === target && run === target.run;
  }

  function release(target, abort = false) {
    if (!target) return;
    for (const timer of ['startupTimer', 'stopTimer', 'resultTimer']) {
      cancelTimer(target[timer]);
    }
    for (const event of ['start', 'audiostart', 'speechstart', 'result', 'error', 'end']) {
      target.recognizer[`on${event}`] = null;
    }
    if (session === target) session = null;
    if (abort) {
      report('abort', target);
      try {
        target.recognizer.abort();
      } catch {
        report('abort-failed', target);
      }
    }
  }

  function finish(error = '') {
    if (run) cancelTimer(run.restartTimer);
    release(session, true);
    run = null;
    setState('idle');
    if (error) onError(error);
  }

  function transcript(target) {
    return [...target.results.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, result]) => result.text.trim())
      .filter(Boolean)
      .join(' ');
  }

  function publish(target) {
    const parts = [...target.run.completed, transcript(target)].filter(Boolean);
    const spoken = parts.join(' ');
    const base = target.run.base;
    const separator = base && spoken && !/\s$/.test(base) ? '\n' : '';
    const text = `${base}${separator}${spoken}`;
    if (text !== target.run.text) {
      target.run.text = text;
      onText(text);
    }
  }

  function armResultTimeout(target) {
    cancelTimer(target.resultTimer);
    target.resultTimer = schedule(() => {
      if (!isCurrent(target) || state !== 'listening') return;
      report('result-timeout', target);
      finish('No speech results were received. Please stop and try again, or use your keyboard microphone.');
    }, resultTimeout);
  }

  function begin(activeRun) {
    if (run !== activeRun) return;
    let recognizer;
    try {
      recognizer = new activeRun.Recognition();
    } catch {
      finish('Could not initialize speech recognition. Please try again.');
      return;
    }
    const target = { id: ++nextId, run: activeRun, recognizer, results: new Map(), started: false };
    session = target;
    setState('starting');
    recognizer.lang = 'en-US';
    recognizer.continuous = !useShortSessions();
    recognizer.interimResults = true;

    target.startupTimer = schedule(() => {
      if (!isCurrent(target) || state !== 'starting') return;
      report('startup-timeout', target);
      finish('Speech recognition did not start. Please try again, or use your keyboard microphone.');
    }, startupTimeout);

    recognizer.onstart = () => {
      if (!isCurrent(target) || state !== 'starting') return;
      report('start', target);
      target.started = true;
      cancelTimer(target.startupTimer);
      setState('listening');
      armResultTimeout(target);
    };
    recognizer.onaudiostart = () => {
      if (isCurrent(target)) report('audiostart', target);
    };
    recognizer.onspeechstart = () => {
      if (isCurrent(target)) report('speechstart', target);
    };
    recognizer.onresult = (event) => {
      if (!isCurrent(target) || !target.started) return;
      report('result', target);
      if (state === 'listening') armResultTimeout(target);
      // Finals are immutable by session/index; interim entries are replaced or removed.
      for (const [index, result] of target.results) {
        if (!result.final && index >= event.results.length) target.results.delete(index);
      }
      for (let index = event.resultIndex ?? 0; index < event.results.length; index++) {
        if (target.results.get(index)?.final) continue;
        const result = event.results[index];
        target.results.set(index, { text: result[0].transcript, final: result.isFinal === true });
      }
      publish(target);
    };
    recognizer.onerror = (event) => {
      if (!isCurrent(target)) return;
      report('error', target, event.error);
      if (event.error === 'aborted' && state === 'stopping') finish();
      else finish(ERROR_MESSAGES[event.error] || 'Speech recognition failed. Please try again.');
    };
    recognizer.onend = () => {
      if (!isCurrent(target)) return;
      report('end', target);
      if (state === 'stopping') {
        finish();
        return;
      }
      if (!target.started) {
        finish('Speech recognition ended before it started. Please try again.');
        return;
      }
      const finals = [...target.results.values()].filter((result) => result.final);
      if (finals.length) {
        // Keep the last visible interim text when restarting would otherwise lose it.
        if ([...target.results.values()].some((result) => !result.final && result.text.trim())) {
          finish('Speech recognition ended. Press Record to continue.');
          return;
        }
        activeRun.completed.push(transcript(target));
        activeRun.emptyEnds = 0;
      } else {
        activeRun.emptyEnds += 1;
        if (target.results.size || activeRun.emptyEnds > 2) {
          finish('Speech recognition ended without a final result. Please try again, or use your keyboard microphone.');
          return;
        }
      }
      activeRun.restarts = activeRun.restarts.filter((timestamp) => now() - timestamp < 60000);
      if (activeRun.restarts.length >= 10) {
        finish('Speech recognition is restarting too often. Please try again, or use your keyboard microphone.');
        return;
      }
      activeRun.restarts.push(now());
      release(target);
      setState('starting');
      report('restart-scheduled', target);
      activeRun.restartTimer = schedule(() => begin(activeRun), restartDelay);
    };

    report('start-request', target);
    try {
      recognizer.start();
    } catch {
      if (isCurrent(target)) finish('Could not start speech recognition. Please try again.');
    }
  }

  function start(base = '') {
    if (state !== 'idle') return;
    const Recognition = getRecognition();
    if (!Recognition) {
      onError('Speech-to-text is not supported by this browser. Use your keyboard microphone instead.');
      return;
    }
    onError('');
    run = { Recognition, base, text: base, completed: [], emptyEnds: 0, restarts: [] };
    // Start directly in the click gesture; recognition handles its own microphone permission.
    begin(run);
  }

  function stop() {
    if (state === 'idle' || state === 'stopping') return;
    if (state === 'starting' || !session) {
      report('cancel-start');
      finish();
      return;
    }
    const target = session;
    setState('stopping');
    report('stop-request', target);
    cancelTimer(target.resultTimer);
    target.stopTimer = schedule(() => {
      if (!isCurrent(target)) return;
      report('stop-timeout', target);
      finish();
    }, stopTimeout);
    try {
      target.recognizer.stop();
    } catch {
      if (isCurrent(target)) finish();
    }
  }

  return {
    start,
    stop,
    cancel: () => finish(),
    getDiagnostics: () => diagnostics.map((entry) => ({ ...entry })),
  };
}
