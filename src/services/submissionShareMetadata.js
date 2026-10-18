/** Set submission-specific share tags and return cleanup for route changes/unmount. */
export function applySubmissionShareMetadata(submission, pageUrl) {
  const title = submission.content?.summary || submission.summary || 'Improvement suggestion';
  const description = submission.content?.details || submission.details || title;
  const firstImage = (submission.content?.photos || submission.photos || [])[0];
  const source = typeof firstImage === 'string' ? firstImage : firstImage?.url;
  let imageUrl = '';
  if (source) {
    try {
      const url = new URL(source, pageUrl);
      if (['http:', 'https:'].includes(url.protocol)) imageUrl = url.href;
    } catch { /* Invalid image URLs cannot be used as public share graphics. */ }
  }
  const imageAlt = firstImage?.caption || title;
  const tags = [
    ['property', 'og:type', 'article'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', pageUrl],
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:alt', imageUrl ? imageAlt : ''],
    ['name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl],
    ['name', 'twitter:image:alt', imageUrl ? imageAlt : ''],
  ];
  const restore = tags.map(([attribute, key, value]) => {
    const existing = document.head.querySelector(`meta[${attribute}="${key}"]`);
    const previous = existing?.getAttribute('content');
    const element = existing || document.createElement('meta');
    if (value) {
      element.setAttribute(attribute, key);
      element.setAttribute('content', String(value));
      if (!existing) document.head.append(element);
    } else if (existing) {
      // Never retain another submission's image when this one has none.
      element.remove();
    }
    return () => {
      if (!existing) element.remove();
      else {
        if (previous === null) element.removeAttribute('content');
        else element.setAttribute('content', previous);
        if (!element.isConnected) document.head.append(element);
      }
    };
  });
  return () => restore.forEach((cleanup) => cleanup());
}
