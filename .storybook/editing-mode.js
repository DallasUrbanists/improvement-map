export function skipAutoplay({ development, pathname, search, defaultEditing }) {
  if (!development || !pathname.endsWith('/iframe.html')) return false;
  const explicit = new URLSearchParams(search).get('editing');
  return explicit === 'true' || (explicit !== 'false' && defaultEditing === 'true');
}
