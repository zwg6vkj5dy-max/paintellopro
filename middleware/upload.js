const path = require('path');
const multer = require('multer');

// Storage for ID documents
const storageIDs = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/ids')),
  filename: (req, file, cb) => cb(null, `ID_${req.user._id}_${Date.now()}_${file.originalname}`)
});

// Storage for project photos
const storageProjects = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/projects')),
  filename: (req, file, cb) => cb(null, `PRJ_${req.user._id}_${Date.now()}_${file.originalname}`)
});

// Only allow images
const filterImages = (req, file, cb) => {
  const ok = /image\/(png|jpg|jpeg|webp)/.test(file.mimetype);
  cb(null, ok);
};

module.exports.uploadIDs = multer({ storage: storageIDs, fileFilter: filterImages });
module.exports.uploadProjects = multer({ storage: storageProjects, fileFilter: filterImages });
