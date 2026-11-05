// JSON draft persistence turns a Blob into {}. Never send that object as an
// upload body or record a public URL before real image bytes are available.
export async function restoreSubmissionPhotoBlob(photo, fetchData = fetch) {
  if (photo.blob instanceof Blob && photo.blob.size > 0 && photo.blob.type === 'image/webp') return photo.blob;
  if (typeof photo.dataUrl === 'string' && photo.dataUrl.startsWith('data:image/webp;')) {
    const response = await fetchData(photo.dataUrl);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0 && blob.type === 'image/webp') return blob;
    }
  }
  throw new Error('This photo could not be restored. Please remove it and add it again.');
}
