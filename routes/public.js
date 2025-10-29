// routes/public.js - For public access without login
const express = require('express');
const router = express.Router();
const Painter = require('../models/Painter');
const Order = require('../models/Order');
const wilayas = require('../utils/wilayas');

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
router.get('/painters/:id', async (req, res) => {
  try {
    const painter = await Painter.findById(req.params.id)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio bio verification availability teamSize businessName');

    if (!painter || painter.verification.status !== 'verified' || !painter.isActive) {
      return res.status(404).render('error', {
        title: 'Painter Not Found',
        message: 'The painter you are looking for is not available.'
      });
    }

    // Get painter's recent completed jobs (public info only)
    const recentJobs = await Order.find({
      'painter.id': painter._id,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(5)
    .select('serviceType budget completedAt')
    .populate('client', 'name');

    res.render('public/painter-profile', {
      title: `${painter.name} - Professional Painter - Paintello Pro`,
      painter: painter,
      recentJobs: recentJobs,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Public painter profile error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Error loading painter profile.'
    });
  }
});

// Guest order creation page
router.get('/painters/:id/order', async (req, res) => {
  try {
    const painter = await Painter.findById(req.params.id)
      .select('name pricePerSqm specialization location');

    if (!painter || painter.verification.status !== 'verified') {
      req.flash('error', 'Painter not available');
      return res.redirect('/painters');
    }

    res.render('public/guest-order', {
      title: `Hire ${painter.name} - Paintello Pro`,
      painter: painter,
      wilayas: wilayas,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Guest order page error:', error);
    req.flash('error', 'Error loading order page');
    res.redirect('/painters');
  }
});

// Handle guest order submission
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

    // Basic validation
    if (!clientName || !clientEmail || !clientPhone || !serviceType || !roomSize) {
      req.flash('error', 'Please fill all required fields');
      return res.redirect(`/painters/${req.params.id}/order`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      req.flash('error', 'Please enter a valid email address');
      return res.redirect(`/painters/${req.params.id}/order`);
    }

    const painter = await Painter.findById(req.params.id);
    if (!painter || painter.verification.status !== 'verified') {
      req.flash('error', 'Painter not available');
      return res.redirect('/painters');
    }

    // Create guest order
    const newOrder = new Order({
      painter: {
        id: painter._id,
        name: painter.name,
        email: painter.email,
        phone: painter.phone
      },
      guestClient: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        wilaya: wilaya,
        address: address
      },
      serviceType,
      roomSize: parseInt(roomSize),
      budget: parseInt(budget) || painter.pricePerSqm * parseInt(roomSize),
      description,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      status: 'pending',
      source: 'guest' // Mark as guest order
    });

    await newOrder.save();

    console.log(`✅ Guest order created for painter ${painter.name} by ${clientName}`);
    
    req.flash('success', `Your order has been submitted successfully! ${painter.name} will contact you soon.`);
    res.redirect('/painters');
    
  } catch (error) {
    console.error('Guest order creation error:', error);
    req.flash('error', 'Error creating order: ' + error.message);
    res.redirect(`/painters/${req.params.id}/order`);
  }
});

module.exports = router;
