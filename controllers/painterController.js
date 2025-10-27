const Painter = require('../models/Painter');
const User = require('../models/User');
const Order = require('../models/Order');

exports.registerPainter = async (req, res) => {
  try {
    const {
      experience,
      specialization,
      wilaya,
      wilayaNumber,
      address,
      pricePerSqm,
      idCard
    } = req.body;

    const painter = new Painter({
      user: req.user.id,
      experience,
      specialization,
      wilaya,
      wilayaNumber,
      address,
      pricePerSqm,
      verification: {
        idCard
      }
    });

    await painter.save();
    
    // Update user role
    await User.findByIdAndUpdate(req.user.id, { role: 'painter' });

    res.status(201).json({
      success: true,
      data: painter
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getPainters = async (req, res) => {
  try {
    const { wilaya, availability, minRating } = req.query;
    
    let query = {};
    if (wilaya) query.wilaya = wilaya;
    if (availability) query.availability = availability === 'true';
    if (minRating) query.rating = { $gte: parseFloat(minRating) };

    const painters = await Painter.find(query)
      .populate('user', 'name email phone')
      .select('-verification.idCard');

    res.json({
      success: true,
      data: painters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getPainterDashboard = async (req, res) => {
  try {
    const painter = await Painter.findOne({ user: req.user.id })
      .populate('user');
    
    const orders = await Order.find({ painter: painter._id })
      .populate('client', 'name phone');
    
    const totalEarnings = await Order.aggregate([
      { $match: { painter: painter._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        painter,
        orders,
        totalEarnings: totalEarnings[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
