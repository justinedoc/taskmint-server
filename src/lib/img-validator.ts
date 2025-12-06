import z from "zod";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_IMG_SIZE = 3 * 1024 * 1024;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const zImage = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, {
    message: "Image must be 5MB or less.",
  })
  .refine((file) => ALLOWED_IMAGE_TYPES.includes(file.type), {
    message: "Only .jpg, .jpeg, .png, .webp, and .gif formats are supported.",
  });
