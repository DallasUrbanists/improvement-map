const origin = process.env.MOCK_CONTROL_ORIGIN || `http://127.0.0.1:${process.env.MOCK_PORT || 4010}`;
const response = await fetch(`${origin}/__mock/reset`, { method: 'POST' });
if (!response.ok) throw Error(`Reset failed: HTTP ${response.status}`);
console.log('Synthetic suggestions reset. Refresh the app and clear browser drafts/bookmarks separately if desired.');
