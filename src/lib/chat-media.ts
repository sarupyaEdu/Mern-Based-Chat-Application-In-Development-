import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  isConfigured = true;
}

export function isCloudinaryConfigured() {
  return isConfigured;
}

function shouldUploadToCloudinary(source: string) {
  return source.startsWith("data:");
}

async function uploadManagedMedia(source: string, folder: string) {
  if (!source) {
    return {
      url: "",
      publicId: "",
    };
  }

  if (!isConfigured || !shouldUploadToCloudinary(source)) {
    return {
      url: source,
      publicId: "",
    };
  }

  const result = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: "image",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadChatMedia(source: string) {
  const result = await uploadManagedMedia(source, "next-chat-app/messages");

  return {
    image: result.url,
    imagePublicId: result.publicId,
  };
}

export async function uploadProfileAvatar(source: string) {
  const result = await uploadManagedMedia(source, "next-chat-app/avatars");

  return {
    avatar: result.url,
    avatarPublicId: result.publicId,
  };
}

export async function deleteChatMedia(publicId?: string) {
  if (!publicId || !isConfigured) {
    return false;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  return true;
}
