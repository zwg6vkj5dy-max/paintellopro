const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  phone: String,
  address: String,
  role: { type: String, enum: ['client', 'painter', 'admin'], default: 'client' },
  passwordHash: { type: String, required: true },
  // Painter-specific fields if role === 'painter'
  painterProfile: {
    approved: { type: Boolean, default: false },
    skills: [String],
    portfolio: [String],
    availability: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviews: [{ clientName: String, comment: String, stars: Number }]
  }
}, { timestamps: true });

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};
userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

