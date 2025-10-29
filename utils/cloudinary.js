// utils/cloudinary.js - UPDATED VERSION
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cloudinary configuration
const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

const isCloudinaryConfigured = !!(config.cloud_name && config.api_key && config.api_secret);

if (isCloudinaryConfigured) {
  cloudinary.config(config);
  console.log('✅ Cloudinary configured');
} else {
  console.warn('⚠️ Cloudinary not configured - check environment variables');
}

// Helper function to safely check arrays
const safeArrayCheck = (value) => {
  return Array.isArray(value) ? value : (value ? [value] : []);
};

// Storage configurations
const createStorage = (folder, transformations) => {
  if (!isCloudinaryConfigured) {
    // Fallback to memory storage if Cloudinary not configured
    return multer.memoryStorage();
  }
  
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
const idCardStorage = createStorage('id-cards', [
  { width: 800, height: 600, crop: 'limit' },
  { quality: 'auto:good' }
]);

const profilePictureStorage = createStorage('profile-pictures', [
  { width: 400, height: 400, crop: 'fill', gravity: 'face' },
  { quality: 'auto:good' }
]);

// File filters
const createFileFilter = (fieldName) => (req, file, cb) => {
  if (file.fieldname === fieldName && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files are allowed for ${fieldName}`), false);
  }
};

// Multer configurations
const uploadIdCard = multer({
  storage: idCardStorage,
  fileFilter: createFileFilter('idCard'),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  }
});

const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  fileFilter: createFileFilter('profilePicture'),
  limits: {
    fileSize: 1 * 1024 * 1024,
    files: 1
  }
});

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
  getCloudinaryStatus,
  isCloudinaryConfigured,
  safeArrayCheck
};
