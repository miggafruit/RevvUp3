import apiClient from './client';

interface VideoUploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export const getVideoUploadSignature = () =>
  apiClient
    .get<{ success: boolean; data: VideoUploadSignature }>('/uploads/video-signature')
    .then((r) => r.data.data);

/**
 * Uploads a video file directly to Cloudinary using a signature this
 * backend generated (see uploadController.getVideoUploadSignature) —
 * the file goes straight from the phone to Cloudinary, never through
 * our own server, which is what keeps a large video upload from tying
 * up backend resources. onProgress reports 0-1 so the UI can show real
 * upload progress instead of just an indefinite spinner, since a video
 * upload over mobile data can genuinely take a while.
 */
export const uploadVideoToCloudinary = (
  localUri: string,
  signature: VideoUploadSignature,
  onProgress?: (fraction: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      type: 'video/mp4',
      name: 'profile-video.mp4',
    } as any);
    formData.append('api_key', signature.apiKey);
    formData.append('timestamp', String(signature.timestamp));
    formData.append('signature', signature.signature);
    formData.append('folder', signature.folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signature.cloudName}/video/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } catch {
          reject(new Error('Unexpected response from video upload.'));
        }
      } else {
        reject(new Error('Video upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('Video upload failed — check your connection and try again.'));

    xhr.send(formData);
  });
};
