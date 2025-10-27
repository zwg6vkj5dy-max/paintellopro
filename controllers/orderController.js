const Order = require('../models/Order');
const Painter = require('../models/Painter');

exports.createOrder = async (req, res) => {
  try {
    const {
      painterId,
      serviceType,
      wilaya,
      address,
      area,
      description,
      scheduledDate
    } = req.body;

    const painter = await Painter.findById(painterId);
    if (!painter) {
      return res.status(404).json({
        success: false,
        error: 'Painter not found'
      });
    }

    const budget = area * painter.pricePerSqm;
    const commission = budget * painter.commissionRate;
    const totalAmount = budget + commission;

    const order = new Order({
      client: req.user.id,
      painter: painterId,
      serviceType,
      wilaya,
      address,
      area,
      description,
      budget,
      commission,
      totalAmount,
      scheduledDate
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getClientOrders = async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user.id })
      .populate('painter')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
