import { v2 as cloudinary } from 'cloudinary';

// The one call to Cloudinary (the SDK reads CLOUDINARY_URL). Tests mock this module.
export function uploadToCloudinary(file: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: 'image', folder: 'internly' }, (err, res) => (res ? resolve(res.secure_url) : reject(err)))
      .end(file);
  });
}
