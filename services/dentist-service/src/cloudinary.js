import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import { config } from './config.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Own folder for organization, per the task brief — keeps dentist photos
// separated from anything else this Cloudinary account might ever store.
const FOLDER = 'dentists';

// multer (memoryStorage) hands us the whole file as a Buffer — Cloudinary's
// SDK only accepts a stream or a local file path for upload_stream, so wrap
// the buffer in a Readable and pipe it through.
export function uploadDentistPhoto(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
}

// Fire-and-log, never fire-and-throw: cleaning up an old/removed photo is
// best-effort housekeeping (avoids orphaned assets piling up on Cloudinary's
// free tier) — it must never fail the request that triggered it (a fresh
// upload replacing an old photo, or an explicit remove). No-ops on a null
// publicId (a dentist with no previous photo).
export async function deleteCloudinaryAsset(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[dentist-service] failed to delete old Cloudinary asset:', err.message);
  }
}
