const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  painter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: {
    description: String,
    area: Number,
    style: String,
    address: String
  },
  pricePerM2: Number,
  commissionPercent: { type: Number, default: 15 },
  // Private client espace photos
  beforePhotos: [String],
  // Auto-calculated
  clientTotal: Number,
  commissionAmount: Number,
  painterNet: Number,
  status: { type: String, enum: ['pending','matched','in-progress','completed'], default: 'pending' }
}, { timestamps: true });

projectSchema.pre('save', function(next) {
  if (this.details.area && this.pricePerM2) {
    this.clientTotal = this.details.area * this.pricePerM2;
    this.commissionAmount = Math.round(this.clientTotal * (this.commissionPercent / 100));
    this.painterNet = this.clientTotal - this.commissionAmount;
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
