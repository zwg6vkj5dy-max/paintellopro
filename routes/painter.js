const express = require('express');
const router = express.Router();
const Painter = require('../models/Painter');
const Order = require('../models/Order');
const wilayas = require('../utils/wilayas');
const StoreProduct = require('../models/StoreProduct'); // Make sure this is at the top
const sendMetaCAPIEvent = require('../services/metaCapi');
const getCleanUserData = require('../utils/userData');

function generateEventId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
// Authentication middleware for painters
const requirePainterAuth = (req, res, next) => {
  if (!req.session.painter) {
    req.flash('error', 'Please login to access painter dashboard');
    return res.redirect('/auth/login-painter');
  }
  next();
};

// Apply authentication to all painter routes
router.use(requirePainterAuth);

router.get('/store-products/:id', async (req, res) => {
  try {
    const product = await StoreProduct.findById(req.params.id);
    if (!product) return res.status(404).render('404');

    // Related products (members‑only)
    const relatedProducts = await StoreProduct.find({
      isActive: true,
      stock: { $gt: 0 },
      _id: { $ne: product._id }
    })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

    // Optional: Meta events (can be omitted if not needed)
   // ----- Meta events (unchanged) -----
    const userData = getCleanUserData(req);
    const pageViewId = generateEventId();
    const viewContentId = generateEventId();
    const addToCartId = generateEventId();

    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'PageView',
        eventId: pageViewId,
        userData,
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }
    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'ViewContent',
        eventId: viewContentId,
        userData,
        customData: {
          content_name: product.name,
          content_ids: [product._id.toString()],
          content_type: 'product',
          value: product.price,
          currency: 'DZD',
          contents: [{
            id: product._id.toString(),
            quantity: 1,
            item_price: product.price
          }]
        },
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    res.render('painter/store-product', {
      title: product.name + ' - Paintello Pro (الأعضاء)',
      product,
      relatedProducts,
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      whatsappPhone: process.env.WHATSAPP_PHONE || '213796530868'
    });
  } catch (error) {
    console.error('StoreProduct detail error:', error);
    if (error.name === 'CastError') {
      return res.status(400).send('Invalid product ID');
    }
    res.status(500).send('Server Error');
  }
});

router.get('/store-products/add-to-cart/:id', async (req, res) => {
  try {
    // Only logged‑in painters can access
    if (!req.session.painter) {
      req.flash('error', 'يرجى تسجيل الدخول كدهان للشراء من متجر الأعضاء.');
      return res.redirect('/painter/login');
    }

    const productId = req.params.id;
    const quantity = parseInt(req.query.qty) || 1;
    const product = await StoreProduct.findById(productId);
    if (!product) return res.status(404).send('Product not found');

    // Simple cart on session
    if (!req.session.cart) {
      req.session.cart = { items: {}, totalQty: 0, totalPrice: 0 };
    }
    const cart = req.session.cart;

    // Use member price
    const itemPrice = product.price;

    if (cart.items[productId]) {
      cart.items[productId].qty += quantity;
      cart.items[productId].price += itemPrice * quantity;
    } else {
      cart.items[productId] = {
        item: {
          _id: product._id,
          name: product.name,
          price: itemPrice,
          image: product.images?.[0] || product.image
        },
        qty: quantity,
        price: itemPrice * quantity
      };
    }

    // Recalculate totals
    cart.totalQty = 0;
    cart.totalPrice = 0;
    for (const id in cart.items) {
      cart.totalQty += cart.items[id].qty;
      cart.totalPrice += cart.items[id].price;
    }

  // 🔥 Server‑side AddToCart with the same event ID as the browser
    const eventId = req.query.eventId;
    const userData = getCleanUserData(req);
    
    if (userData && eventId) {
      await sendMetaCAPIEvent({
        eventName: 'AddToCart',
        eventId,
        userData,
        customData: {
          content_name: product.name,
          content_ids: [product._id.toString()],
          content_type: 'product',
          value: product.price * quantity,
          currency: 'DZD',
          contents: [{
            id: product._id.toString(),
            quantity,
            item_price: product.price
          }]
        },
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    // Redirect to checkout
    res.redirect('/checkout');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


// Updated dashboard route with real-time commission calculatio

router.get('/dashboard', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);

    req.session.painter = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter',
      profilePicture: painter.profilePicture
    };

    // Get recent orders for this painter
    const recentOrders = await Order.find({ 
      painter: req.session.painter._id 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('client', 'name email phone');

    // Calculate ONLY ACCEPTED/COMPLETED orders for financial stats
    const financialOrders = await Order.find({
      painter: req.session.painter._id,
      status: { $in: ['accepted', 'in_progress', 'completed'] }
    });

    const totalEarnings = financialOrders.reduce((total, order) => {
      const orderAmount = order.totalAmount || order.budget || 0;
      const commission = order.commission || Math.round(orderAmount * 0.10);
      return total + (orderAmount - commission);
    }, 0);

    const totalCommission = financialOrders.reduce((total, order) => {
      const orderAmount = order.totalAmount || order.budget || 0;
      return total + (order.commission || Math.round(orderAmount * 0.10));
    }, 0);

    const totalRevenue = financialOrders.reduce((total, order) => {
      return total + (order.totalAmount || order.budget || 0);
    }, 0);

    const pendingJobs = await Order.countDocuments({ 
      painter: req.session.painter._id,
      status: 'pending'
    });

    const acceptedJobs = await Order.countDocuments({
      painter: req.session.painter._id,
      status: 'accepted'
    });

    const inProgressJobs = await Order.countDocuments({
      painter: req.session.painter._id,
      status: 'in_progress'
    });

    const completedJobs = await Order.countDocuments({ 
      painter: req.session.painter._id,
      status: 'completed'
    });

    const totalJobs = await Order.countDocuments({ 
      painter: req.session.painter._id 
    });

    const activeJobs = pendingJobs + acceptedJobs + inProgressJobs;

    const stats = {
      totalJobs,
      completedJobs,
      pendingJobs,
      acceptedJobs,
      inProgressJobs,
      activeJobs,
      totalEarnings,
      totalCommission,
      totalRevenue,
      completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
    };

    // --- Members-only store products ---
    let storeProducts = [];
    try {
      storeProducts = await StoreProduct.find({ 
        isActive: true,
        stock: { $gt: 0 }
      })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    } catch (productError) {
      console.error('Error fetching member store products:', productError);
    }

    res.render('painter/dashboard', {
      title: 'Painter Dashboard - Paintello Pro',
      painter: painter,
      recentJobs: recentOrders,
      stats: stats,
      storeProducts: storeProducts,
      success: req.flash('success')[0],
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/painter/dashboard');
  }
});

// Helper function to calculate total earnings after commission
async function calculateTotalEarnings(painterId) {
  const completedOrders = await Order.find({
    painter: painterId,
    status: 'completed'
  });

  return completedOrders.reduce((total, order) => {
    const orderAmount = order.totalAmount || 0;
    const commission = order.commission || 0;
    const painterEarnings = orderAmount - commission;
    return total + painterEarnings;
  }, 0);
}

// Helper function to calculate total commission
async function calculateTotalCommission(painterId) {
  const completedOrders = await Order.find({
    painter: painterId,
    status: 'completed'
  });

  return completedOrders.reduce((total, order) => {
    return total + (order.commission || 0);
  }, 0);
}
// Painter Profile
router.get('/profile', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    res.render('painter/profile', {
      title: 'Profile - Paintello Pro',
      painter: painter,
      wilayas: wilayas,
      success: req.flash('success')[0],
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Error loading profile');
    res.redirect('/painter/dashboard');
  }
});

// In your painter.js route - CORRECTED VERSION
const { uploadProfilePicture, deleteFromCloudinary, getCloudinaryStatus } = require('../utils/cloudinary');

// Update Painter Profile with Profile Picture
// In your painter.js route - UPDATED VERSION
router.post('/profile', uploadProfilePicture.single('profilePicture'), async (req, res) => {
  try {
    console.log('🔍 Profile update request received');
    
    const cloudinaryStatus = getCloudinaryStatus();
    const isCloudinaryConfigured = cloudinaryStatus.configured;
    
    console.log('   File uploaded:', !!req.file);
    console.log('   Cloudinary configured:', isCloudinaryConfigured);

    const { name, phone, experience, pricePerSqm, specialization, wilaya, address, bio, availability, businessName, teamSize } = req.body;
    
    const updateData = {
      name,
      phone,
      experience: parseInt(experience),
      pricePerSqm: parseInt(pricePerSqm),
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      'location.wilaya': wilaya,
      'location.address': address,
      bio,
      availability,
      businessName,
      teamSize: parseInt(teamSize)
    };

    // Handle profile picture upload
    if (req.file && isCloudinaryConfigured) {
      console.log('🔄 Processing profile picture upload...');
      console.log('   Uploaded file details:', {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      });
      // ✅ Add file size validation (1MB max)
  if (req.file.size > 1 * 1024 * 1024) {
    console.warn('❌ Uploaded image too large:', req.file.size);
    try {
      await deleteFromCloudinary(req.file.filename);
    } catch (err) {
      console.error('⚠️ Error cleaning up large file from Cloudinary:', err);
    }
    req.flash('error', 'Image too large. Please upload a file under 1 MB.');
    return res.redirect('/painter/profile');
  }
      // Delete old profile picture if exists
      const currentPainter = await Painter.findById(req.session.painter._id);
      if (currentPainter.profilePicture && currentPainter.profilePicture.publicId) {
        try {
          await deleteFromCloudinary(currentPainter.profilePicture.publicId);
          console.log('✅ Old profile picture deleted from Cloudinary');
        } catch (deleteError) {
          console.error('❌ Error deleting old profile picture:', deleteError);
        }
      }

      // Add new profile picture data - FIXED: Use proper Cloudinary response
      updateData.profilePicture = {
        publicId: req.file.filename, // This should be the Cloudinary public_id
        url: req.file.path, // This should be the Cloudinary URL
        uploadedAt: new Date()
      };
      
      console.log('✅ New profile picture data:', updateData.profilePicture);
    }

    const updatedPainter = await Painter.findByIdAndUpdate(
      req.session.painter._id,
      updateData,
      { new: true, runValidators: true }
    );

    // CRITICAL: Update session with ALL painter data, not just name
    req.session.painter = {
      _id: updatedPainter._id,
      name: updatedPainter.name,
      email: updatedPainter.email,
      phone: updatedPainter.phone,
      role: 'painter',
      profilePicture: updatedPainter.profilePicture // Add profile picture to session
    };

    console.log('✅ Profile updated successfully');
    console.log('   Profile picture in DB:', updatedPainter.profilePicture);
    
    req.flash('success', 'Profile updated successfully');
    res.redirect('/painter/profile');
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file && req.file.filename && isCloudinaryConfigured) {
      try {
        await deleteFromCloudinary(req.file.filename);
        console.log('✅ Uploaded file deleted due to error');
      } catch (deleteError) {
        console.error('❌ Error deleting uploaded file:', deleteError);
      }
    }
    
    req.flash('error', 'Error updating profile: ' + error.message);
    res.redirect('/painter/profile');
  }
});

// Painter Portfolio Management - READ ONLY
router.get('/portfolio', async (req, res) => {
    try {
        const painter = await Painter.findById(req.session.painter._id);
        
        res.render('painter/portfolio', {
            title: 'Portfolio - Paintello Pro',
            painter: painter,
            success: req.flash('success')[0],
            error: req.flash('error')[0]
        });
    } catch (error) {
        console.error('Portfolio error:', error);
        req.flash('error', 'Error loading portfolio');
        res.redirect('/painter/dashboard');
    }
});

// Remove the POST route for portfolio addition since painters can't add directly
// You'll manage portfolio additions through admin routes or direct MongoDB updates
// Painter Orders/Jobs
router.get('/orders', async (req, res) => {
  try {
    const { status = 'all', page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build query
    let query = { 'painter.id': req.session.painter._id };
    if (status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client', 'name email phone');

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('painter/orders', {
      title: 'My Jobs - Paintello Pro',
      orders: orders,
      status: status,
      currentPage: parseInt(page),
      totalPages: totalPages,
      painter: req.session.painter
    });
  } catch (error) {
    console.error('Orders error:', error);
    req.flash('error', 'Error loading orders');
    res.redirect('/painter/dashboard');
  }
});

// Update Order Status
router.post('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order || order.painter.id.toString() !== req.session.painter._id.toString()) {
      req.flash('error', 'Order not found');
      return res.redirect('/painter/orders');
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    req.flash('success', `Order status updated to ${status}`);
    res.redirect('/painter/orders');
  } catch (error) {
    console.error('Status update error:', error);
    req.flash('error', 'Error updating order status');
    res.redirect('/painter/orders');
  }
});

// Painter Portfolio Management
router.get('/portfolio', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    res.render('painter/portfolio', {
      title: 'Portfolio - Paintello Pro',
      painter: painter,
      success: req.flash('success')[0],
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    req.flash('error', 'Error loading portfolio');
    res.redirect('/painter/dashboard');
  }
});

// Add Portfolio Item (Flickr URL)
router.post('/portfolio', async (req, res) => {
  try {
    const { flickrUrl, description } = req.body;
    
    if (!flickrUrl) {
      req.flash('error', 'Flickr URL is required');
      return res.redirect('/painter/portfolio');
    }

    const portfolioItem = {
      flickrUrl: flickrUrl,
      description: description || '',
      uploadedAt: new Date()
    };

    await Painter.findByIdAndUpdate(
      req.session.painter._id,
      { $push: { portfolio: portfolioItem } },
      { new: true }
    );

    req.flash('success', 'Portfolio image added successfully');
    res.redirect('/painter/portfolio');
  } catch (error) {
    console.error('Portfolio add error:', error);
    req.flash('error', 'Error adding portfolio image');
    res.redirect('/painter/portfolio');
  }
});

// Remove Portfolio Item
router.post('/portfolio/remove', async (req, res) => {
  try {
    const { portfolioIndex } = req.body;
    
    const painter = await Painter.findById(req.session.painter._id);
    if (painter && painter.portfolio[portfolioIndex]) {
      painter.portfolio.splice(portfolioIndex, 1);
      await painter.save();
    }

    req.flash('success', 'Portfolio image removed');
    res.redirect('/painter/portfolio');
  } catch (error) {
    console.error('Portfolio remove error:', error);
    req.flash('error', 'Error removing portfolio image');
    res.redirect('/painter/portfolio');
  }
});

// Painter Store
router.get('/store', async (req, res) => {
  try {
    // For now, return empty products array
    // You can integrate with your product models later
    const products = [];
    
    res.render('painter/store/products', {
      title: 'Team Store - Paintello Pro',
      products: products,
      category: 'all',
      cartCount: 0,
      painter: req.session.painter
    });
  } catch (error) {
    console.error('Store error:', error);
    req.flash('error', 'Error loading store');
    res.redirect('/painter/dashboard');
  }
});

// Helper function to calculate total earnings
async function calculateTotalEarnings(painterId) {
  try {
    const completedOrders = await Order.find({
      'painter.id': painterId,
      status: 'completed'
    });
    
    return completedOrders.reduce((total, order) => {
      return total + (order.totalAmount || 0);
    }, 0);
  } catch (error) {
    console.error('Earnings calculation error:', error);
    return 0;
  }
}

// Painter Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});
// Painter Availability Management
router.get('/availability', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    // Get current and upcoming jobs for context
    const currentJobs = await Order.find({
      'painter.id': req.session.painter._id,
      status: { $in: ['accepted', 'in_progress'] }
    }).sort({ createdAt: -1 });

    const upcomingJobs = await Order.find({
      'painter.id': req.session.painter._id,
      status: 'scheduled',
      scheduledDate: { $gte: new Date() }
    }).sort({ scheduledDate: 1 });

    res.render('painter/availability', {
      title: 'Manage Availability - Paintello Pro',
      painter: painter,
      currentJobs: currentJobs,
      upcomingJobs: upcomingJobs,
      success: req.flash('success')[0],
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Availability page error:', error);
    req.flash('error', 'Error loading availability page');
    res.redirect('/painter/dashboard');
  }
});

// Update Availability Status
router.post('/availability/status', async (req, res) => {
  try {
    const { status, reason, availableFrom } = req.body;
    
    const updateData = {
      availability: status
    };

    // Add availability notes if provided
    if (reason) {
      updateData.availabilityNotes = reason;
    }

    // Set available from date if provided
    if (availableFrom && status === 'unavailable') {
      updateData.availableFrom = new Date(availableFrom);
    } else {
      updateData.availableFrom = null;
    }

    const updatedPainter = await Painter.findByIdAndUpdate(
      req.session.painter._id,
      updateData,
      { new: true }
    );

    console.log(`✅ Availability updated to: ${status} for ${updatedPainter.name}`);
    
    req.flash('success', `Your availability has been updated to ${status}`);
    res.redirect('/painter/availability');
    
  } catch (error) {
    console.error('Availability update error:', error);
    req.flash('error', 'Error updating availability');
    res.redirect('/painter/availability');
  }
});

// Set Custom Availability Schedule
router.post('/availability/schedule', async (req, res) => {
  try {
    const { scheduleType, workingDays, workingHours, maxJobsPerWeek } = req.body;
    
    const availabilitySchedule = {
      scheduleType: scheduleType || 'flexible',
      workingDays: Array.isArray(workingDays) ? workingDays : [workingDays],
      workingHours: workingHours || '9:00-17:00',
      maxJobsPerWeek: parseInt(maxJobsPerWeek) || 3,
      updatedAt: new Date()
    };

    await Painter.findByIdAndUpdate(
      req.session.painter._id,
      { availabilitySchedule: availabilitySchedule },
      { new: true }
    );

    console.log(`✅ Availability schedule updated for painter: ${req.session.painter._id}`);
    
    req.flash('success', 'Your availability schedule has been updated');
    res.redirect('/painter/availability');
    
  } catch (error) {
    console.error('Availability schedule error:', error);
    req.flash('error', 'Error updating availability schedule');
    res.redirect('/painter/availability');
  }
});

// Add Busy Period
router.post('/availability/busy-period', async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    
    const busyPeriod = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || 'Busy period',
      createdAt: new Date()
    };

    await Painter.findByIdAndUpdate(
      req.session.painter._id,
      { 
        $push: { busyPeriods: busyPeriod },
        availability: 'busy' // Automatically set to busy during this period
      },
      { new: true }
    );

    console.log(`✅ Busy period added: ${startDate} to ${endDate}`);
    
    req.flash('success', 'Busy period added successfully');
    res.redirect('/painter/availability');
    
  } catch (error) {
    console.error('Busy period error:', error);
    req.flash('error', 'Error adding busy period');
    res.redirect('/painter/availability');
  }
});

// Remove Busy Period
router.post('/availability/busy-period/remove', async (req, res) => {
  try {
    const { periodId } = req.body;
    
    await Painter.findByIdAndUpdate(
      req.session.painter._id,
      { 
        $pull: { busyPeriods: { _id: periodId } }
      },
      { new: true }
    );

    console.log(`✅ Busy period removed: ${periodId}`);
    
    req.flash('success', 'Busy period removed successfully');
    res.redirect('/painter/availability');
    
  } catch (error) {
    console.error('Remove busy period error:', error);
    req.flash('error', 'Error removing busy period');
    res.redirect('/painter/availability');
  }
});
// Order Acceptance Route - FIXED
// Order Acceptance Route - WITH IMMEDIATE COMMISSION CALCULATION
router.post('/orders/:id/accept', async (req, res) => {
  try {
    const orderId = req.params.id;
    const painterId = req.session.painter._id;

    console.log('🎯 Accepting order:', orderId, 'for painter:', painterId);

    // Find the order and verify it belongs to this painter
    const order = await Order.findOne({
      _id: orderId,
      painter: painterId,
      status: 'pending'
    });

    if (!order) {
      console.log('❌ Order not found or not pending');
      req.flash('error', 'Order not found or already processed');
      return res.redirect('/painter/dashboard');
    }

    // Calculate commission (10%) if not already calculated
    if (!order.commission && order.totalAmount) {
      order.commission = Math.round(order.totalAmount * 0.10);
    } else if (!order.commission && order.budget) {
      // If no totalAmount, use budget to calculate commission
      order.commission = Math.round(order.budget * 0.10);
      order.totalAmount = order.budget; // Set totalAmount equal to budget
    }

    // Update order status to accepted
    order.status = 'accepted';
    order.respondedAt = new Date();
    order.acceptedAt = new Date();

    await order.save();

    console.log('✅ Order accepted with commission:', {
      orderId: orderId,
      totalAmount: order.totalAmount,
      commission: order.commission,
      painterEarnings: order.totalAmount - order.commission
    });

    req.flash('success', `Order accepted! Commission: ${order.commission} DZD, Your Earnings: ${order.totalAmount - order.commission} DZD`);
    res.redirect('/painter/dashboard');

  } catch (error) {
    console.error('❌ Order acceptance error:', error);
    req.flash('error', 'Error accepting order: ' + error.message);
    res.redirect('/painter/dashboard');
  }
});

// Order Decline Route - NO CALCULATION
router.post('/orders/:id/decline', async (req, res) => {
  try {
    const orderId = req.params.id;
    const painterId = req.session.painter._id;

    const order = await Order.findOne({
      _id: orderId,
      painter: painterId,
      status: 'pending'
    });

    if (!order) {
      req.flash('error', 'Order not found or already processed');
      return res.redirect('/painter/dashboard');
    }

    // Simply decline without any financial calculation
    order.status = 'cancelled';
    order.respondedAt = new Date();
    order.cancelledAt = new Date();
    order.cancellationReason = 'declined_by_painter';

    await order.save();

    req.flash('info', 'Order declined successfully. No financial impact.');
    res.redirect('/painter/dashboard');

  } catch (error) {
    console.error('Order decline error:', error);
    req.flash('error', 'Error declining order');
    res.redirect('/painter/dashboard');
  }
});
module.exports = router;
