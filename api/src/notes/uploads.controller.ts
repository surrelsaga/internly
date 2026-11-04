import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadToCloudinary } from './cloudinary.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

@Controller('uploads')
export class UploadsController {
  // A file over 5MB makes multer throw 413 on its own.
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async image(@UploadedFile() file?: { mimetype: string; buffer: Buffer }) {
    // ponytail: trusts the declared mimetype, doesn't sniff the bytes. Cloudinary rejects non-images anyway.
    if (!file || !TYPES.includes(file.mimetype)) throw new BadRequestException('Send one png, jpeg, gif or webp image');
    return { url: await uploadToCloudinary(file.buffer) };
  }
}
