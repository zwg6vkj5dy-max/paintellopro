const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  painter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Painter',
    required: true
  },
  serviceType: {
    type: String,
    required: true,
    enum: ['interior', 'exterior', 'commercial', 'residential']
  },
  wilaya: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  area: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  commission: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  scheduledDate: Date,
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
