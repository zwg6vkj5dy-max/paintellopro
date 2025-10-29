const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Remove the console.log checks or make them more efficient
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Cloudinary Configuration Check:');
  console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing');
  console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');
}

// Cloudinary configuration - use modern approach
const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

const isCloudinaryConfigured = !!(config.cloud_name && config.api_key && config.api_secret);

if (isCloudinaryConfigured) {
  cloudinary.config(config);
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Cloudinary configured for ID cards and profile pictures');
  }
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ Cloudinary not fully configured - File uploads will fail');
}

// Use Array.isArray instead of util.isArray in any custom code
const validateSpecialization = (specialization) => {
  return Array.isArray(specialization) ? specialization : [specialization];
};

// Configure storage with better error handling
const createCloudinaryStorage = (folder, transformations) => {
  if (!isCloudinaryConfigured) return undefined;
  
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `paintello-pro/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: transformations,
      public_id: (req, file) => {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        return `${folder}_${timestamp}_${randomString}`;
      }
    },
  });
};

// Create storages
const idCardStorage = createCloudinaryStorage('id-cards', [
  { width: 800, height: 600, crop: 'limit' },
  { quality: 'auto:good' }
]);

const profilePictureStorage = createCloudinaryStorage('profile-pictures', [
  { width: 400, height: 400, crop: 'fill', gravity: 'face' },
  { quality: 'auto:good' }
]);

// Modern file filter functions
const createFileFilter = (fieldName) => (req, file, cb) => {
  if (file.fieldname === fieldName && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files are allowed for ${fieldName}`), false);
  }
};

// Configure multer instances
const createMulterUpload = (storage, fieldName) => {
  return multer({
    storage: storage,
    fileFilter: createFileFilter(fieldName),
    limits: {
      fileSize: fieldName === 'idCard' ? 2 * 1024 * 1024 : 1 * 1024 * 1024,
      files: 1
    }
  });
};

const uploadIdCard = createMulterUpload(idCardStorage, 'idCard');
const uploadProfilePicture = createMulterUpload(profilePictureStorage, 'profilePicture');

// Utility functions
const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary not configured');
  }
  
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

const uploadProfileImage = async (fileBuffer, painterId) => {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary not configured');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'paintello-pro/profile-pictures',
        public_id: `profile_${painterId}_${Date.now()}`,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

const getCloudinaryStatus = () => ({
  configured: isCloudinaryConfigured,
  cloud_name: !!config.cloud_name,
  api_key: !!config.api_key,
  api_secret: !!config.api_secret
});

module.exports = {
  cloudinary,
  uploadIdCard,
  uploadProfilePicture,
  deleteFromCloudinary,
  uploadProfileImage,
  getCloudinaryStatus,
  isCloudinaryConfigured,
  validateSpecialization
};
