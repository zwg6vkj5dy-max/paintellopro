const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    index: true
  },
  price: {                          // Member price (shown to logged‑in painters)
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  publicPrice: {                    // Optional: original price for non‑members
    type: Number,
    min: 0
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  image: String,                    // Fallback image URL
  images: [String],                 // Array of image URLs
  category: {
    type: String,
    enum: ['paint', 'tools', 'accessories', 'other'],
    required: true
  },
  videoFile: String,                // Cloudinary/direct video URL
  videoId: String,                  // YouTube video ID
  features: [String],
  specifications: [{
    key: { type: String, required: true },
    value: { type: String, required: true }
  }],
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

storeProductSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StoreProduct', storeProductSchema);
