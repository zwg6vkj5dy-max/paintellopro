const express = require('express');
const router = express.Router();
const Painter = require('../models/Painter');
const Order = require('../models/Order');
const wilayas = require('../utils/wilayas');

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

// In your painter.js route file - update the dashboard function
router.get('/dashboard', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    // Get recent orders for this painter
    const recentOrders = await Order.find({ 
      'painter.id': req.session.painter._id 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('client', 'name email phone');

    // Calculate comprehensive stats
    const totalJobs = await Order.countDocuments({ 
      'painter.id': req.session.painter._id 
    });
    
    const completedJobs = await Order.countDocuments({ 
      'painter.id': req.session.painter._id,
      status: 'completed'
    });
    
    const pendingJobs = await Order.countDocuments({ 
      'painter.id': req.session.painter._id,
      status: 'pending'
    });

    const activeJobs = await Order.countDocuments({
      'painter.id': req.session.painter._id,
      status: { $in: ['pending', 'accepted', 'in_progress'] }
    });

    const inProgressJobs = await Order.countDocuments({
      'painter.id': req.session.painter._id,
      status: 'in_progress'
    });

    // Calculate monthly earnings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlyEarningsData = await Order.find({
      'painter.id': req.session.painter._id,
      status: 'completed',
      updatedAt: { $gte: thirtyDaysAgo }
    });

    const monthlyEarnings = monthlyEarningsData.reduce((total, order) => {
      return total + (order.totalAmount || 0);
    }, 0);

    const totalEarnings = await calculateTotalEarnings(req.session.painter._id);

    // Calculate response rate (orders responded to within 24 hours)
    const respondedOrders = await Order.countDocuments({
      'painter.id': req.session.painter._id,
      'painter.respondedAt': { $exists: true }
    });

    const responseRate = totalJobs > 0 ? Math.round((respondedOrders / totalJobs) * 100) : 0;

    const stats = {
      totalJobs,
      completedJobs,
      pendingJobs,
      activeJobs,
      inProgressJobs,
      monthlyEarnings,
      totalEarnings,
      responseRate,
      completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
    };

    res.render('painter/dashboard', {
      title: 'Painter Dashboard - Paintello Pro',
      painter: painter,
      recentJobs: recentOrders,
      stats: stats,
      success: req.flash('success')[0],
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/painter/dashboard');
  }
});
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
router.post('/profile', uploadProfilePicture.single('profilePicture'), async (req, res) => {
  try {
    console.log('🔍 Profile update request received');
    
    // Check Cloudinary status
    const cloudinaryStatus = getCloudinaryStatus();
    const isCloudinaryConfigured = cloudinaryStatus.configured;
    
    console.log('   File uploaded:', !!req.file);
    console.log('   Cloudinary configured:', isCloudinaryConfigured);
    console.log('   Request body fields:', Object.keys(req.body));

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
      console.log('   Uploaded file:', {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      });
      
      // Delete old profile picture if exists
      const currentPainter = await Painter.findById(req.session.painter._id);
      if (currentPainter.profilePicture && currentPainter.profilePicture.publicId) {
        try {
          await deleteFromCloudinary(currentPainter.profilePicture.publicId);
          console.log('✅ Old profile picture deleted');
        } catch (deleteError) {
          console.error('❌ Error deleting old profile picture:', deleteError);
        }
      }

      // Add new profile picture data
      updateData.profilePicture = {
        publicId: req.file.filename,
        url: req.file.path,
        uploadedAt: new Date()
      };
      
      console.log('✅ New profile picture data saved');
    } else if (req.file && !isCloudinaryConfigured) {
      console.log('⚠️ File uploaded but Cloudinary not configured');
      req.flash('error', 'File upload service not available. Please try again later.');
    } else {
      console.log('ℹ️ No file uploaded or Cloudinary not configured');
    }

    const updatedPainter = await Painter.findByIdAndUpdate(
      req.session.painter._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Update session with new data
    req.session.painter.name = updatedPainter.name;
    
    console.log('✅ Profile updated successfully');
    req.flash('success', 'Profile updated successfully');
    res.redirect('/painter/profile');
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file && req.file.filename) {
      try {
        const cloudinaryStatus = getCloudinaryStatus();
        if (cloudinaryStatus.configured) {
          await deleteFromCloudinary(req.file.filename);
          console.log('✅ Uploaded file deleted due to error');
        }
      } catch (deleteError) {
        console.error('❌ Error deleting uploaded file:', deleteError);
      }
    }
    
    req.flash('error', 'Error updating profile: ' + error.message);
    res.redirect('/painter/profile');
  }
});

// Remove Profile Picture
router.post('/profile/remove-picture', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    if (painter.profilePicture && painter.profilePicture.publicId) {
      // Delete from Cloudinary
      await deleteFromCloudinary(painter.profilePicture.publicId);
      
      // Remove from database
      painter.profilePicture = undefined;
      await painter.save();
      
      req.flash('success', 'Profile picture removed successfully');
    } else {
      req.flash('error', 'No profile picture to remove');
    }
    
    res.redirect('/painter/profile');
  } catch (error) {
    console.error('Remove profile picture error:', error);
    req.flash('error', 'Error removing profile picture');
    res.redirect('/painter/profile');
  }
});
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

module.exports = router;
