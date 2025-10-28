const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const painterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  experience: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerSqm: {
    type: Number,
    required: true,
    min: 0
  },
  specialization: [{
    type: String,
    enum: ['interior', 'exterior', 'commercial', 'residential']
  }],
  location: {
    wilaya: String,
    wilayaNumber: Number,
    address: String
  },
  verification: {
    idCard: {
      publicId: String, // Cloudinary public_id
      url: String,      // Cloudinary URL
      uploadedAt: Date
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedAt: Date,
    adminNotes: String
  },
  portfolio: [{
    flickrUrl: String,  // Manual Flickr URL
    description: String,
    uploadedByAdmin: {
      type: Boolean,
      default: false
    },
    uploadedAt: Date
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  userType: {
    type: String,
    default: 'painter'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String // For admin internal notes
}, {
  timestamps: true
});

painterSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for formatted verification status
painterSchema.virtual('verificationStatus').get(function() {
  return this.verification.status.charAt(0).toUpperCase() + 
         this.verification.status.slice(1);
});

module.exports = mongoose.model('Painter', painterSchema);
