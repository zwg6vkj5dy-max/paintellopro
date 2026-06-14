// routes/public.js - For public access without login
const express = require('express');
const router = express.Router();
const Painter = require('../models/Painter');
const Order = require('../models/Order');
const wilayas = require('../utils/wilayas');
// Temporary home route in public.js (remove later)
router.get('/', async (req, res) => {
  try {
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
    .sort({ rating: -1, completedJobs: -1 })
    .limit(6)
    .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    res.render('index', {
      title: 'Paintello Pro - Find Professional Painters in Algeria',
      featuredPainters: featuredPainters,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('index', {
      title: 'Paintello Pro - Find Professional Painters in Algeria',
      featuredPainters: [],
      user: req.session.user || null
    });
  }
});
// Arabic route for painters search (same data, different view)
router.get('/ar/painters', async (req, res) => {
  try {
    const { wilaya, specialization, minRating, maxPrice, minExperience, availability, sort = 'rating' } = req.query;
    
    // Build query – exactly the same as English version
    let query = { 
      'verification.status': 'verified',
      'isActive': true
    };

    if (wilaya && wilaya !== 'all') query['location.wilaya'] = wilaya;
    if (specialization) query['specialization'] = Array.isArray(specialization) ? { $in: specialization } : specialization;
    if (minRating) query['rating'] = { $gte: parseFloat(minRating) };
    if (maxPrice) query['pricePerSqm'] = { $lte: parseInt(maxPrice) };
    if (minExperience) query['experience'] = { $gte: parseInt(minExperience) };
    if (availability === 'true') query['availability'] = 'available';

    let sortOptions = {};
    switch (sort) {
      case 'rating': sortOptions = { rating: -1, completedJobs: -1 }; break;
      case 'experience': sortOptions = { experience: -1, rating: -1 }; break;
      case 'price_low': sortOptions = { pricePerSqm: 1 }; break;
      case 'price_high': sortOptions = { pricePerSqm: -1 }; break;
      default: sortOptions = { rating: -1 };
    }

    const painters = await Painter.find(query)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio verification availability')
      .sort(sortOptions);

    // Render the Arabic view (make sure the file exists at views/public/paintersar.ejs)
    res.render('public/paintersar', {
      title: 'ابحث عن دهانين محترفين - بينتيلو برو',
      painters: painters,
      wilayas: wilayas,
      query: req.query,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Arabic painters search error:', error);
    res.render('public/paintersar', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: [],
      wilayas: wilayas,
      query: {},
      error: 'حدث خطأ أثناء تحميل الدهانين'
    });
  }
});
// Public painter search page
router.get('/painters', async (req, res) => {
  try {
    const { wilaya, specialization, minRating, maxPrice, minExperience, availability, sort = 'rating' } = req.query;
    
    // Build query - only show verified and active painters
    let query = { 
      'verification.status': 'verified',
      'isActive': true
    };

    // Apply filters
    if (wilaya && wilaya !== 'all') {
      query['location.wilaya'] = wilaya;
    }

    if (specialization) {
      query['specialization'] = Array.isArray(specialization) ? { $in: specialization } : specialization;
    }

    if (minRating) {
      query['rating'] = { $gte: parseFloat(minRating) };
    }

    if (maxPrice) {
      query['pricePerSqm'] = { $lte: parseInt(maxPrice) };
    }

    if (minExperience) {
      query['experience'] = { $gte: parseInt(minExperience) };
    }

    if (availability === 'true') {
      query['availability'] = 'available';
    }

    // Build sort object
    let sortOptions = {};
    switch (sort) {
      case 'rating':
        sortOptions = { rating: -1, completedJobs: -1 };
        break;
      case 'experience':
        sortOptions = { experience: -1, rating: -1 };
        break;
      case 'price_low':
        sortOptions = { pricePerSqm: 1 };
        break;
      case 'price_high':
        sortOptions = { pricePerSqm: -1 };
        break;
      default:
        sortOptions = { rating: -1 };
    }

    const painters = await Painter.find(query)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio verification availability')
      .sort(sortOptions);

    res.render('public/painters', {
      title: 'Find Professional Painters - Paintello Pro',
      painters: painters,
      wilayas: wilayas,
      query: req.query,
      user: req.session.user || null // Pass user if logged in
    });
  } catch (error) {
    console.error('Public painters search error:', error);
    res.render('public/painters', {
      title: 'Find Painters - Paintello Pro',
      painters: [],
      wilayas: wilayas,
      query: {},
      error: 'Error loading painters'
    });
  }
});

// Public painter profile page
// Public painter profile page - UPDATED VERSION
router.get('/painters/:id', async (req, res) => {
  try {
    console.log('🔍 Loading painter profile for ID:', req.params.id);
    
    // First, check if the ID is valid
    if (!req.params.id || req.params.id.length !== 24) {
      console.log('❌ Invalid painter ID format');
      return res.status(404).render('error', {
        title: 'Painter Not Found',
        message: 'Invalid painter ID format.'
      });
    }

    // Find the painter without verification check first
    const painter = await Painter.findById(req.params.id)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio bio verification availability teamSize businessName');

    console.log('✅ Database query result:', painter ? `Found: ${painter.name}` : 'Not found');

    if (!painter) {
      console.log('❌ Painter not found in database');
      return res.status(404).render('error', {
        title: 'Painter Not Found',
        message: 'The painter you are looking for does not exist.'
      });
    }

    // Check verification status but don't block access
    if (painter.verification.status !== 'verified') {
      console.log('⚠️ Painter not verified:', painter.verification.status);
      // Still show the profile but with a warning
    }

    if (!painter.isActive) {
      console.log('⚠️ Painter not active');
      // Still show the profile but with a warning
    }

    // Get painter's recent completed jobs
    const recentJobs = await Order.find({
      'painter.id': painter._id,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(5)
    .select('serviceType budget completedAt')
    .populate('client', 'name');

    console.log('🎨 Rendering painter profile for:', painter.name);

    res.render('public/painter-profile', {
      title: `${painter.name} - Professional Painter - Paintello Pro`,
      painter: painter,
      recentJobs: recentJobs,
      user: req.session.user || null,
      isVerified: painter.verification.status === 'verified',
      isActive: painter.isActive
    });

  } catch (error) {
    console.error('❌ Public painter profile error:', error);
    
    // Check if it's a CastError (invalid ID format)
    if (error.name === 'CastError') {
      return res.status(404).render('error', {
        title: 'Invalid Painter ID',
        message: 'The painter ID format is invalid.'
      });
    }
    
    res.status(500).render('error', {
      title: 'Error',
      message: 'An error occurred while loading the painter profile.'
    });
  }
});
// Guest order creation page - UPDATED VERSION
router.get('/painters/:id/order', async (req, res) => {
  try {
    console.log('🔍 Loading guest order page for painter:', req.params.id);
    
    const painter = await Painter.findById(req.params.id)
      .select('name pricePerSqm specialization location profilePicture experience rating verification isActive availability');

    if (!painter) {
      console.log('❌ Painter not found');
      req.flash('error', 'Painter not found');
      return res.redirect('/painters');
    }

    // Check if painter can accept orders
    if (painter.verification.status !== 'verified') {
      console.log('❌ Painter not verified:', painter.verification.status);
      req.flash('error', 'This painter is not yet verified and cannot accept orders.');
      return res.redirect(`/painters/${painter._id}`);
    }

    if (!painter.isActive) {
      console.log('❌ Painter not active');
      req.flash('error', 'This painter account is currently inactive and cannot accept orders.');
      return res.redirect(`/painters/${painter._id}`);
    }

    if (painter.availability !== 'available') {
      console.log('❌ Painter not available:', painter.availability);
      req.flash('warning', 'This painter is currently not available for new projects.');
      // Still allow ordering but show warning
    }

    console.log('✅ Loading guest order form for:', painter.name);

    res.render('public/guest-order', {
      title: `Hire ${painter.name} - Paintello Pro`,
      painter: painter,
      wilayas: wilayas,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('❌ Guest order page error:', error);
    req.flash('error', 'Error loading order page');
    res.redirect('/painters');
  }
});


// Handle guest order submission - UPDATED FOR FIXED SCHEMA
router.post('/painters/:id/order', async (req, res) => {
  try {
    const { 
      clientName, 
      clientEmail, 
      clientPhone, 
      wilaya, 
      address, 
      serviceType, 
      roomSize, 
      budget, 
      description, 
      preferredDate 
    } = req.body;

    // Enhanced validation
    if (!clientName || !clientEmail || !clientPhone || !serviceType || !roomSize || !wilaya || !address || !description) {
      req.flash('error', 'Please fill all required fields');
      return res.redirect(`/painters/${req.params.id}/order`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect(`/painters/${req.params.id}/order`);
    }

    // Validate room size is a number
    const area = parseInt(roomSize);
    if (isNaN(area) || area < 1) {
      req.flash('error', 'Please enter a valid room size');
      return res.redirect(`/painters/${req.params.id}/order`);
    }

    const painter = await Painter.findById(req.params.id);
    if (!painter || painter.verification.status !== 'verified') {
      req.flash('error', 'Painter not available');
      return res.redirect('/painters');
    }

    // Calculate financials
    const totalAmount = parseInt(budget) || painter.pricePerSqm * area;
    const commission = Math.round(totalAmount * 0.10); // 10% commission

    // Create guest order with proper structure
    const newOrder = new Order({
      // Guest client information
      guestClient: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone
      },
      // Painter reference (just the ID)
      painter: painter._id,
      // Service details
      serviceType: serviceType,
      // Location details
      wilaya: wilaya,
      address: address,
      area: area,
      // Order description
      description: description,
      // Financials
      budget: totalAmount,
      totalAmount: totalAmount,
      commission: commission,
      // Dates
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      // Mark as guest order
      source: 'guest'
    });

    await newOrder.save();

    console.log(`✅ Guest order created for painter ${painter.name} by ${clientName}`);
    
    req.flash('success', `Your order has been submitted successfully! ${painter.name} will contact you soon.`);
    res.redirect('/painters');
    
  } catch (error) {
    console.error('❌ Guest order creation error:', error);
    req.flash('error', 'Error creating order: ' + error.message);
    res.redirect(`/painters/${req.params.id}/order`);
  }
});

module.exports = router;
