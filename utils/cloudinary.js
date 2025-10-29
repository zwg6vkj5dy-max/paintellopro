const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

console.log('🔧 Cloudinary Configuration Check:');
console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing');
console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');

// Cloudinary configuration
const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

// Check if all Cloudinary environment variables are present
const isCloudinaryConfigured = config.cloud_name && config.api_key && config.api_secret;

if (isCloudinaryConfigured) {
  cloudinary.config(config);
  console.log('✅ Cloudinary configured for ID cards and profile pictures');
} else {
  console.warn('⚠️ Cloudinary not fully configured - File uploads will fail');
  console.warn('   Required environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

// Configure storage for ID cards
const idCardStorage = isCloudinaryConfigured 
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'paintello-pro/id-cards',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        public_id: (req, file) => {
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 8);
          return `idcard_${timestamp}_${randomString}`;
        }
      },
    })
  : undefined;

// Configure storage for profile pictures
const profilePictureStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'paintello-pro/profile-pictures',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good' }
        ],
        public_id: (req, file) => {
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 8);
          return `profile_${timestamp}_${randomString}`;
        }
      },
    })
  : undefined;

// File filter for ID cards
const idCardFileFilter = (req, file, cb) => {
  if (file.fieldname === 'idCard' && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for ID cards'), false);
  }
};

// File filter for profile pictures
const profilePictureFileFilter = (req, file, cb) => {
  if (file.fieldname === 'profilePicture' && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for profile pictures'), false);
  }
};

// Configure multer for ID cards
const uploadIdCard = multer({
  storage: idCardStorage,
  fileFilter: idCardFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1
  }
});

// Configure multer for profile pictures
const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  fileFilter: profilePictureFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit for profile pictures
    files: 1
  }
});

// Utility function to delete image from Cloudinary
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

// Function to upload profile picture
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

// Check Cloudinary status
const getCloudinaryStatus = () => {
  return {
    configured: isCloudinaryConfigured,
    cloud_name: config.cloud_name ? 'Set' : 'Not set',
    api_key: config.api_key ? 'Set' : 'Not set',
    api_secret: config.api_secret ? 'Set' : 'Not set'
  };
};

module.exports = {
  cloudinary,
  uploadIdCard,
  uploadProfilePicture,
  deleteFromCloudinary,
  uploadProfileImage,
  getCloudinaryStatus,
  isCloudinaryConfigured
};
