// Only optional OSM acquisition may be skipped. Rendering, App Check and upload
// errors still fail the submission rather than claiming an image was saved.
export async function createOptionalLocationThumbnail({ acquire, render, upload, onUnavailable }) {
  let locationData;
  try {
    locationData = await acquire();
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    onUnavailable?.(error);
    return null;
  }
  return upload(await render(locationData));
}
