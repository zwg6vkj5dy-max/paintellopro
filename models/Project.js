const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  painter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // role: painter
  details: {
    description: String,
    roomSize: String,
    style: String,
    budget: Number,
    colors: [String],
    address: String
  },
  status: { 
    type: String, 
    enum: ['pending', 'matched', 'in-progress', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  beforePhotos: [String],
  afterPhotos: [String],
  commissionPercent: { type: Number, default: 15 },
  priceQuoted: Number,
  pricePaid: Number
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);


