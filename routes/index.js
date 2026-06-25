const express = require('express');
const router = express.Router();
const sendMetaCAPIEvent = require('../services/metaCapi');
const getCleanUserData = require('../utils/userData');
function generateEventId() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
const wilayas = require('../utils/wilayas');
const Painter = require('../models/Painter');
const bcrypt = require('bcrypt');
const { uploadIdCard, deleteFromCloudinary } = require('../utils/cloudinary');
// Painter Login Page - FIXED PATH
// Route pour la recherche des peintres en arabe

router.get('/ar/painters', async (req, res) => {
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

    res.render('painters', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: painters,
      wilayas: wilayas,
      query: req.query,
      user: req.session.user || null,
      lang: 'ar'
    });
  } catch (error) {
    console.error('Public painters search error:', error);
    res.render('painters', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: [],
      wilayas: wilayas,
      query: {},
      error: 'خطأ في تحميل الدهانين',
      lang: 'ar'
    });
  }
});

// Route pour le profil public en arabe
router.get('/ar/painters/:id', async (req, res) => {
  try {
    console.log('🔍 Loading painter profile for ID:', req.params.id);
    
    // First, check if the ID is valid
    if (!req.params.id || req.params.id.length !== 24) {
      console.log('❌ Invalid painter ID format');
      return res.status(404).render('error', {
        title: 'الدهان غير موجود',
        message: 'صيغة معرف الدهان غير صالحة.',
        lang: 'ar'
      });
    }

    // Find the painter without verification check first
    const painter = await Painter.findById(req.params.id)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio bio verification availability teamSize businessName');

    console.log('✅ Database query result:', painter ? `Found: ${painter.name}` : 'Not found');

    if (!painter) {
      console.log('❌ Painter not found in database');
      return res.status(404).render('error', {
        title: 'الدهان غير موجود',
        message: 'الدهان الذي تبحث عنه غير موجود.',
        lang: 'ar'
      });
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

    res.render('painter-profile', {
      title: `${painter.name} - دهان محترف - بينتيلو برو`,
      painter: painter,
      recentJobs: recentJobs,
      user: req.session.user || null,
      isVerified: painter.verification.status === 'verified',
      isActive: painter.isActive,
      lang: 'ar'
    });

  } catch (error) {
    console.error('❌ Public painter profile error:', error);
    
    // Check if it's a CastError (invalid ID format)
    if (error.name === 'CastError') {
      return res.status(404).render('error', {
        title: 'معرف دهان غير صالح',
        message: 'صيغة معرف الدهان غير صالحة.',
        lang: 'ar'
      });
    }
    
    res.status(500).render('error', {
      title: 'خطأ',
      message: 'حدث خطأ أثناء تحميل ملف الدهان.',
      lang: 'ar'
    });
  }
});
// ---------- HOME PAGE ----------
router.get('/', async (req, res) => {
  try {
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
    .sort({ rating: -1, completedJobs: -1 })
    .limit(6)
    .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    const userData = getCleanUserData(req);
    const pageViewId = generateEventId();

    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'PageView',
        eventId: pageViewId,
        userData,
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    res.render('index', {
      title: 'Paintello Pro - Find Professional Painters in Algeria',
      featuredPainters,
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: pageViewId,
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('index', {
      title: 'Paintello Pro - Find Professional Painters in Algeria',
      featuredPainters: [],
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: '',
    });
  }
});

// ---------- ARABIC HOME PAGE ----------
router.get('/ar', async (req, res) => {
  try {
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
    .sort({ rating: -1, completedJobs: -1 })
    .limit(6)
    .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    const userData = getCleanUserData(req);
    const pageViewId = generateEventId();

    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'PageView',
        eventId: pageViewId,
        userData,
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    res.render('ar/index', {
      title: 'بينتيلو برو - منصة الدهانين المحترفين في الجزائر',
      featuredPainters,
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: pageViewId,
    });
  } catch (error) {
    console.error('Arabic home page error:', error);
    res.render('ar/index', {
      title: 'بينتيلو برو - منصة الدهانين المحترفين في الجزائر',
      featuredPainters: [],
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: '',
    });
  }
});
// Utility function to check if Cloudinary URL is accessible
const checkCloudinaryUrl = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Use it in your routes
router.get('/validate-profile-picture', async (req, res) => {
  try {
    const painter = await Painter.findById(req.session.painter._id);
    
    if (painter.profilePicture && painter.profilePicture.url) {
      const isValid = await checkCloudinaryUrl(painter.profilePicture.url);
      
      res.json({
        hasProfilePicture: true,
        url: painter.profilePicture.url,
        isValid: isValid,
        message: isValid ? 'Profile picture URL is valid' : 'Profile picture URL is invalid'
      });
    } else {
      res.json({
        hasProfilePicture: false,
        message: 'No profile picture found'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Painter Login Page - FIXED VERSION

router.get('/auth/login-painter', (req, res) => {
  if (req.session.painter && req.session.painter.role === 'painter') {
    return res.redirect('/painter/dashboard');
  }
  const pageViewId = generateEventId();
  let completeRegistrationId = null;

  // Check if we have a pending registration event ID
  if (req.session.pendingEvents && req.session.pendingEvents.completeRegistration) {
    completeRegistrationId = req.session.pendingEvents.completeRegistration;
    // Remove it so it only fires once
    delete req.session.pendingEvents.completeRegistration;
    // Optionally clean up the pendingEvents object if empty
    if (Object.keys(req.session.pendingEvents).length === 0) {
      delete req.session.pendingEvents;
    }
  }

  res.render('auth/login-painter', {
    title: 'Painter Login - Paintello Pro',
    user: req.session.user || null,
    sessionPainter: req.session.painter || null,
    painter: null,
    metaEventIdPageView: pageViewId,
    metaEventIdCompleteRegistration: completeRegistrationId, // 👈 pass to view
  });
});

// Painter Registration Routes
// ---------- PAINTER REGISTRATION PAGE ----------
router.get('/auth/register-painter', (req, res) => {
  const completeRegistrationId = generateEventId();
  req.session.pendingEvents = req.session.pendingEvents || {};
  req.session.pendingEvents.completeRegistration = completeRegistrationId;

  const pageViewId = generateEventId(); // optional, but good for consistency

  res.render('auth/register-painter', {
    title: 'انضم كدهان - بينتيلو برو',
    wilayas,
    oldInput: req.flash('oldInput')[0] || {},
    error: req.flash('error'),
    success: req.flash('success'),
    warning: req.flash('warning'),
    info: req.flash('info'),
    user: req.session.user || null,
    sessionPainter: req.session.painter || null,
    painter: null,
    metaEventIdPageView: pageViewId,
    metaEventIdCompleteRegistration: completeRegistrationId,
  });
});

// 🎨 Painter Registration (with flash messages)
// ---------- PAINTER REGISTRATION POST ----------
router.post('/auth/register-painter', uploadIdCard.single('idCard'), async (req, res) => {
  try {
    const {
      name, phone, email, password, confirmPassword,
      experience, pricePerSqm, specialization,
      wilaya, wilayaNumber, address
    } = req.body;

    const oldInput = req.body;

    // ---- validation ----
    if (!name || !phone || !email || !password || !confirmPassword || !experience || !pricePerSqm || !specialization || !wilaya || !address) {
      req.flash('error', '⚠️ Please fill in all required fields.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }
    if (password !== confirmPassword) {
      req.flash('error', '❌ Passwords do not match.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }
    const existingPainter = await Painter.findOne({ $or: [{ email }, { phone }] });
    if (existingPainter) {
      req.flash('warning', '⚠️ Account already exists. Please log in.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/login-painter');
    }
    if (!req.file || !req.file.path) {
      req.flash('error', '🪪 Please upload a valid ID card.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }

    // ---- create painter ----
    const painter = new Painter({
      name,
      phone,
      email,
      password,
      experience,
      pricePerSqm,
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      location: { wilaya, wilayaNumber, address },
      profilePicture: { url: '', public_id: '' },
      idCard: { url: req.file.path, public_id: req.file.filename },
      verification: { status: 'pending', adminNotes: 'Awaiting verification', verifiedAt: null },
      isActive: false
    });

    await painter.save();

    // ---- CAPI CompleteRegistration ----
    const userData = getCleanUserData(req);
    let completeRegistrationId = req.session.pendingEvents?.completeRegistration;
    if (!completeRegistrationId) completeRegistrationId = generateEventId();
    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'CompleteRegistration',
        eventId: completeRegistrationId,
        userData,
        customData: {
          registration_method: 'painter_signup',
          experience: req.body.experience,
          specialization: Array.isArray(req.body.specialization) ? req.body.specialization.join(', ') : req.body.specialization,
          wilaya: req.body.wilaya,
        },
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    // ---- success ----
    console.log(`🆕 New painter registered: ${name} (${email})`);
    req.flash('success', '🎉 Registration successful! Your account is pending verification.');
    return res.redirect('/auth/login-painter');

  } catch (error) {
    console.error('Painter registration error:', error);
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename);
    }
    req.flash('error', '❗ An unexpected error occurred.');
    req.flash('oldInput', req.body);
    return res.redirect('/auth/register-painter');
  }
});



// Handle painter registration with Cloudinary ID card upload
// 🎨 Painter Login Route (Final Flash Version)
router.post('/auth/login-painter', async (req, res) => {
  try {
    const { email, password } = req.body;
    const formData = { email };

    // 🟠 Case 0: Missing fields
    if (!email || !password) {
      req.flash('error', '⚠️ Please enter both your email and password.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // 🔍 Case 1: Painter not found
    const painter = await Painter.findOne({ email });
    if (!painter) {
      req.flash('info', 'ℹ️ No account found with this email. You can register as a painter below.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // 🔐 Case 2: Incorrect password
    const isMatch = await painter.comparePassword(password);
    if (!isMatch) {
      req.flash('error', '❌ Incorrect password. Please try again or contact support if forgotten.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // 🕓 Case 3: Account not verified
    if (painter.verification.status !== 'verified') {
      let message = '';
      switch (painter.verification.status) {
        case 'pending':
          message = '🕒 Your account is still pending verification. We will contact you once approved.';
          break;
        case 'rejected':
          message = '🚫 Your verification was rejected. Please contact support for more details.';
          break;
        default:
          message = '⚠️ Your account must be verified before logging in.';
      }
      req.flash('warning', message);
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // 🚫 Case 4: Account inactive
    if (!painter.isActive) {
      req.flash('error', '🚫 Your account has been deactivated. Please contact support to reactivate it.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // ✅ Case 5: Successful login
    req.session.painter = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter',
      profilePicture: painter.profilePicture,
      verification: painter.verification
    };

    req.session.user = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter'
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', '⚠️ Login failed due to session issue. Please try again.');
        return res.redirect('/auth/login-painter');
      }

      console.log(`✅ Painter logged in successfully: ${painter.name} (${painter.email})`);
      req.flash('success', `🎉 Welcome back, ${painter.name}!`);
      res.redirect('/painter/dashboard');
    });

  } catch (error) {
    console.error('Painter login error:', error);
    req.flash('error', '❗ An unexpected error occurred during login. Please try again later.');
    req.flash('oldInput', req.body);
    res.redirect('/auth/login-painter');
  }
});



const painterRoutes = require('./painter');

// Mount painter routes
router.use('/painter', painterRoutes);

// Add this to your routes/index.js
const clientRoutes = require('./client');

// Mount client routes
router.use('/client', clientRoutes);

// Logout route
router.get('/logout', (req, res) => {
  console.log('🚪 Logging out user:', req.session.user ? req.session.user.name : 'No user');
  console.log('🚪 Logging out painter:', req.session.painter ? req.session.painter.name : 'No painter');
  
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/painter/dashboard');
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid');
    
    console.log('✅ User logged out successfully');
    res.redirect('/');
  });
});

// Alternative logout with flash message
router.post('/logout', (req, res) => {
  const userName = req.session.user ? req.session.user.name : 
                   req.session.painter ? req.session.painter.name : 'User';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      req.flash('error', 'Error during logout');
      return res.redirect('/painter/dashboard');
    }
    
    res.clearCookie('connect.sid');
    req.flash('success', `Goodbye, ${userName}! You have been logged out successfully.`);
    res.redirect('/');
  });
});

module.exports = router;
    

