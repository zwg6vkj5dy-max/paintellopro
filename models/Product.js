const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['paint', 'tools', 'equipment', 'accessories'],
    required: true
  },
  subcategory: String,
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  images: [String],
  stock: {
    type: Number,
    required: true
  },
  points: {
    type: Number,
    default: 0 // Points earned when purchasing
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
