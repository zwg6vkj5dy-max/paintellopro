const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const painterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // In your Painter model, ensure you have:

  // In your Painter model, add this field:
profilePicture: {
  publicId: String, // Cloudinary public_id
  url: String,      // Cloudinary URL
  uploadedAt: Date
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
  
  // NEW FIELDS ADDED FOR DASHBOARD FUNCTIONALITY
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Performance metrics
  responseRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Job statistics
  activeJobs: {
    type: Number,
    default: 0
  },
  
  inProgressJobs: {
    type: Number,
    default: 0
  },
  
  pendingJobs: {
    type: Number,
    default: 0
  },
  
  // Earnings tracking
  totalEarnings: {
    type: Number,
    default: 0
  },
  
  monthlyEarnings: {
    type: Number,
    default: 0
  },
  
  // Additional profile fields
  bio: {
    type: String,
    maxlength: 500
  },
  
  availability: {
    type: String,
    enum: ['available', 'busy', 'unavailable'],
    default: 'available'
  },
  // Add to your Painter model
availabilitySchedule: {
  scheduleType: {
    type: String,
    enum: ['flexible', 'fixed'],
    default: 'flexible'
  },
  workingDays: [String],
  workingHours: String,
  maxJobsPerWeek: {
    type: Number,
    default: 3
  },
  updatedAt: Date
},

busyPeriods: [{
  startDate: Date,
  endDate: Date,
  reason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}],

availabilityNotes: String,
availableFrom: Date
  // Social media and contact
  website: String,
  facebook: String,
  instagram: String,
  
  // Business information
  businessName: String,
  teamSize: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Service areas
  serviceAreas: [{
    wilaya: String,
    wilayaNumber: Number
  }],

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

// Virtual for isVerified (to match EJS template)
painterSchema.virtual('isVerified').get(function() {
  return this.verification.status === 'verified';
});

// Virtual for full address
painterSchema.virtual('fullAddress').get(function() {
  if (this.location.address && this.location.wilaya) {
    return `${this.location.address}, ${this.location.wilaya}`;
  }
  return this.location.wilaya || 'Address not specified';
});

// Virtual for experience level
painterSchema.virtual('experienceLevel').get(function() {
  if (this.experience >= 10) return 'Expert';
  if (this.experience >= 5) return 'Experienced';
  if (this.experience >= 2) return 'Intermediate';
  return 'Beginner';
});

// Virtual for average rating with stars
painterSchema.virtual('ratingStars').get(function() {
  return '★'.repeat(Math.floor(this.rating)) + '☆'.repeat(5 - Math.floor(this.rating));
});

// Method to update performance metrics
painterSchema.methods.updatePerformanceMetrics = async function() {
  const Order = mongoose.model('Order');
  
  const totalJobs = await Order.countDocuments({ 'painter.id': this._id });
  const completedJobs = await Order.countDocuments({ 
    'painter.id': this._id, 
    status: 'completed' 
  });
  const respondedJobs = await Order.countDocuments({
    'painter.id': this._id,
    'painter.respondedAt': { $exists: true }
  });
  
  // Update rates
  this.completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  this.responseRate = totalJobs > 0 ? Math.round((respondedJobs / totalJobs) * 100) : 0;
  
  // Update job counts
  this.activeJobs = await Order.countDocuments({
    'painter.id': this._id,
    status: { $in: ['pending', 'accepted', 'in_progress'] }
  });
  
  this.inProgressJobs = await Order.countDocuments({
    'painter.id': this._id,
    status: 'in_progress'
  });
  
  this.pendingJobs = await Order.countDocuments({
    'painter.id': this._id,
    status: 'pending'
  });
  
  this.completedJobs = completedJobs;
  
  await this.save();
};

// Method to calculate monthly earnings
painterSchema.methods.calculateMonthlyEarnings = async function() {
  const Order = mongoose.model('Order');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const monthlyOrders = await Order.find({
    'painter.id': this._id,
    status: 'completed',
    updatedAt: { $gte: thirtyDaysAgo }
  });
  
  this.monthlyEarnings = monthlyOrders.reduce((total, order) => {
    return total + (order.totalAmount || 0);
  }, 0);
  
  await this.save();
};

// Method to add loyalty points
painterSchema.methods.addLoyaltyPoints = async function(points, reason) {
  this.loyaltyPoints += points;
  await this.save();
  console.log(`Added ${points} loyalty points to ${this.name} for: ${reason}`);
};

// Static method to find available painters in a wilaya
painterSchema.statics.findByWilaya = function(wilayaNumber) {
  return this.find({
    'location.wilayaNumber': wilayaNumber,
    'verification.status': 'verified',
    'isActive': true,
    'availability': 'available'
  }).sort({ rating: -1, completedJobs: -1 });
};

// Ensure virtual fields are serialized
painterSchema.set('toJSON', { virtuals: true });
painterSchema.set('toObject', { virtuals: true });

// Index for better performance
painterSchema.index({ 'location.wilayaNumber': 1, 'verification.status': 1 });
painterSchema.index({ rating: -1 });
painterSchema.index({ 'specialization': 1 });

module.exports = mongoose.model('Painter', painterSchema);
