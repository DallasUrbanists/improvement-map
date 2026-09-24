/**
 * Improvement Map - Suggestion & Photo Upload Test Helper
 */

// Automatically detect local dev vs production API server
const API_BASE_URL =
  'https://urbanists-cloud-api-server-143738155808.us-central1.run.app';

let resizedBlob = null;

const photoFileInput = document.getElementById('photoFile');
const previewContainer = document.getElementById('previewContainer');
const photoPreview = document.getElementById('photoPreview');
const fileInfo = document.getElementById('fileInfo');
const statusMessage = document.getElementById('statusMessage');
const responseContainer = document.getElementById('responseContainer');
const responseJson = document.getElementById('responseJson');
const submitBtn = document.getElementById('submitBtn');

/**
 * Resizes an image file using an HTML5 Canvas to keep file sizes small.
 */
function resizeImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, width, height });
            } else {
              reject(new Error('Canvas toBlob conversion failed.'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// Handle file selection and client-side resizing
photoFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    resizedBlob = null;
    previewContainer.style.display = 'none';
    fileInfo.textContent = '';
    return;
  }

  const originalSizeKb = (file.size / 1024).toFixed(1);
  fileInfo.textContent = `Original: ${file.name} (${originalSizeKb} KB). Processing...`;

  try {
    const result = await resizeImage(file);
    resizedBlob = result.blob;

    const resizedSizeKb = (resizedBlob.size / 1024).toFixed(1);
    fileInfo.textContent = `Original: ${originalSizeKb} KB → Resized WebP (${result.width}x${result.height}): ${resizedSizeKb} KB`;

    photoPreview.src = URL.createObjectURL(resizedBlob);
    previewContainer.style.display = 'block';
  } catch (err) {
    console.error('Resize error:', err);
    fileInfo.textContent = `Resize error: ${err.message}`;
  }
});

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'error' : 'success';
  statusMessage.style.display = 'block';
}

// Handle form submission
document.getElementById('suggestionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiUrl = API_BASE_URL;
  const authorName = document.getElementById('authorName').value.trim();
  const authorEmail = document.getElementById('authorEmail').value.trim();
  const summary = document.getElementById('summary').value.trim();
  const details = document.getElementById('details').value.trim();
  const address = document.getElementById('address').value.trim();
  const photoCaption = document.getElementById('photoCaption').value.trim();

  const latVal = document.getElementById('latitude').value.trim();
  const lngVal = document.getElementById('longitude').value.trim();
  const latitude = latVal ? parseFloat(latVal) : undefined;
  const longitude = lngVal ? parseFloat(lngVal) : undefined;

  submitBtn.disabled = true;
  responseContainer.style.display = 'none';
  showStatus('Preparing submission...', false);

  try {
    const photos = [];

    // Step 1: If a photo is attached, request a signed upload URL and upload directly to GCS
    if (resizedBlob) {
      showStatus('Requesting signed upload URL from API...', false);
      const signResponse = await fetch(`${apiUrl}/api/public-improvements/suggestions/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: 'image/webp',
          filename: photoFileInput.files[0]?.name || 'photo.webp',
        }),
      });

      const signData = await signResponse.json();
      if (!signResponse.ok || !signData.data?.uploadUrl) {
        throw new Error(signData.message || signData.error || 'Failed to generate signed upload URL from API');
      }

      const { uploadUrl, publicUrl } = signData.data;

      showStatus('Uploading resized photo binary directly to Google Cloud Storage via Signed URL...', false);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/webp',
        },
        body: resizedBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Signed GCS upload failed: HTTP ${uploadResponse.status} ${uploadResponse.statusText}. Check bucket CORS configuration.`
        );
      }

      photos.push({
        url: publicUrl,
        caption: photoCaption || 'Civic improvement photo',
        timestamp: new Date().toISOString(),
      });
    }

    // Step 2: Post Suggestion to Cloud API Server
    showStatus('Submitting suggestion to API server...', false);

    const payload = {
      author: {
        name: authorName,
        email: authorEmail,
      },
      content: {
        summary,
        details,
        ...(photos.length > 0 ? { photos } : {}),
      },
      ...(latitude !== undefined || longitude !== undefined || address
        ? {
            location: {
              ...(latitude !== undefined ? { latitude } : {}),
              ...(longitude !== undefined ? { longitude } : {}),
              address,
            },
          }
        : {}),
    };

    const apiResponse = await fetch(`${apiUrl}/api/public-improvements/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resultData = await apiResponse.json();

    if (!apiResponse.ok) {
      throw new Error(resultData.error || `API returned HTTP ${apiResponse.status}`);
    }

    showStatus('Suggestion created successfully!', false);
    responseJson.textContent = JSON.stringify(resultData, null, 2);
    responseContainer.style.display = 'block';
  } catch (error) {
    console.error('Submission error:', error);
    showStatus(`Error: ${error.message}`, true);
  } finally {
    submitBtn.disabled = false;
  }
});
