const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

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
  console.log('✅ Cloudinary configured for ID card uploads');
} else {
  console.warn('⚠️ Cloudinary not fully configured - ID card uploads will fail');
  console.warn('   Required environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

// Configure storage for ID cards only
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

// File filter for ID cards only
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'idCard' && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for ID cards'), false);
  }
};

// Configure multer - use memory storage if Cloudinary not configured
const uploadIdCard = multer({
  storage: idCardStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
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
  deleteFromCloudinary,
  getCloudinaryStatus,
  isCloudinaryConfigured
};
