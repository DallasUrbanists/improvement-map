import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';

if (__LOCAL_DEPENDENCY_MODES__.geolocation === 'mock') {
  const position = { coords: { latitude: 32.7767, longitude: -96.797, accuracy: 10 }, timestamp: Date.now() };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: success => setTimeout(() => success(position), 0),
    watchPosition: success => { setTimeout(() => success(position), 0); return 1; }, clearWatch() {},
  } });
}
if (__LOCAL_DEPENDENCY_MODES__.speech === 'mock') {
  class MockRecognition {
    start() {
      this.timer = setTimeout(() => {
        this.onstart?.(); this.onaudiostart?.(); this.onspeechstart?.();
        const result = [{ transcript: 'Add a safer crossing near the bus stop.', confidence: 1 }];
        result.isFinal = true;
        this.onresult?.({ resultIndex: 0, results: [result] });
        this.onend?.();
      }, 300);
    }
    stop() { clearTimeout(this.timer); this.onend?.(); }
    abort() { clearTimeout(this.timer); }
  }
  window.SpeechRecognition = MockRecognition;
  window.webkitSpeechRecognition = MockRecognition;
}
