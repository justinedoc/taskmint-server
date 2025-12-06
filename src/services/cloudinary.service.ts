/** biome-ignore-all lint/complexity/noStaticOnlyClass: <...> */
import { Readable } from "node:stream";
import cloudinary from "@/config/cloudinary.js";

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  // biome-ignore lint/suspicious/noExplicitAny: <...>
  [key: string]: any;
}

export interface UploadOptions {
  public_id: string;
  folder: string;
}

export class CloudinaryService {
  public static async uploadWithBase64(
    base64String: string,
    options: UploadOptions,
  ): Promise<CloudinaryUploadResult> {
    try {
      const result = await cloudinary.uploader.upload(base64String, {
        folder: options.folder,
        public_id: options.public_id,
        overwrite: true,
      });
      return result as CloudinaryUploadResult;
    } catch (error) {
      console.error("Cloudinary Base64 upload failed:", error);
      throw error;
    }
  }

  public static uploadWithBuffer(
    buffer: Buffer,
    options: UploadOptions,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.public_id,
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error("Cloudinary stream upload failed."));
          resolve(result as CloudinaryUploadResult);
        },
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }
}
