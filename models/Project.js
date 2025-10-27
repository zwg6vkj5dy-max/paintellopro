const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  painter: { type: mongoose.Schema.Types.ObjectId, ref: 'Painter' },
  details: {
    description: String,
    roomSize: String,
    style: String,
    budget: Number,
    colors: [String]
  },
  status: { 
    type: String, 
    enum: ['pending', 'matched', 'in-progress', 'completed'], 
    default: 'pending' 
  },
  beforePhotos: [String],
  afterPhotos: [String]
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

