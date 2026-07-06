const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Painter = require('../models/Painter');
const Order = require('../models/Order'); // make sure this is imported if used
const bcrypt = require('bcrypt');
const sendMetaCAPIEvent = require('../services/metaCapi');
const getCleanUserData = require('../utils/userData');
const wilayas = require('../utils/wilayas');
const { uploadIdCard, deleteFromCloudinary } = require('../utils/cloudinary');
var Cart = require("../models/cart");
const { createPayment, verifyPayment } = require('../helpers/chargily');
const { sendPurchaseForDeliveredCOD } = require('../helpers/deliveryEvents');
const ProductOrder = require('../models/ProductOrder');
const { sendTelegramMessage } = require('../helpers/telegram');


function generateEventId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
// Add to Cart – from product page "Buy Now" button
router.get('/products/add-to-cart/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const quantity = parseInt(req.query.qty) || 1;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send('Product not found');

    // Simple cart on session
    if (!req.session.cart) {
      req.session.cart = { items: {}, totalQty: 0, totalPrice: 0 };
    }
    const cart = req.session.cart;

    if (cart.items[productId]) {
      cart.items[productId].qty += quantity;
      cart.items[productId].price += product.price * quantity;
    } else {
      cart.items[productId] = {
        item: {
          _id: product._id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || product.image
        },
        qty: quantity,
        price: product.price * quantity
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


// ==================== HOME ROUTES (BEFORE any parameterised catch-all) ====================
router.get('/', async (req, res) => {
  try {
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
      .sort({ rating: -1, completedJobs: -1 })
      .limit(6)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    const featuredProducts = await Product.find({ featured: true })
      .sort({ createdAt: -1 })
      .limit(8);

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
      featuredProducts,
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
      featuredProducts: [],
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: '',
    });
  }
});

// Arabic home
router.get('/ar', async (req, res) => {
  try {
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
      .sort({ rating: -1, completedJobs: -1 })
      .limit(6)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    const featuredProducts = await Product.find({ featured: true })
      .sort({ createdAt: -1 })
      .limit(8);

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
      featuredProducts,
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
      featuredProducts: [],
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      painter: null,
      metaEventIdPageView: '',
    });
  }
});

// ==================== ARABIC PAINTER ROUTES (explicit paths before any /:id) ====================
router.get('/ar/painters', async (req, res) => {
  // ... (your existing Arabic painters search route – unchanged)
  try {
    const { wilaya, specialization, minRating, maxPrice, minExperience, availability, sort = 'rating' } = req.query;
    let query = { 'verification.status': 'verified', 'isActive': true };
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
    res.render('painters', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters, wilayas, query: req.query,
      user: req.session.user || null, lang: 'ar'
    });
  } catch (error) {
    console.error('Public painters search error:', error);
    res.render('painters', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: [], wilayas, query: {},
      error: 'خطأ في تحميل الدهانين', lang: 'ar'
    });
  }
});

router.get('/ar/painters/:id', async (req, res) => {
  // ... (your existing Arabic painter profile route – unchanged)
  try {
    if (!req.params.id || req.params.id.length !== 24) {
      return res.status(404).render('error', {
        title: 'الدهان غير موجود', message: 'صيغة معرف الدهان غير صالحة.', lang: 'ar'
      });
    }
    const painter = await Painter.findById(req.params.id)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio bio verification availability teamSize businessName');
    if (!painter) return res.status(404).render('error', {
      title: 'الدهان غير موجود', message: 'الدهان الذي تبحث عنه غير موجود.', lang: 'ar'
    });
    const recentJobs = await Order.find({ 'painter.id': painter._id, status: 'completed' })
      .sort({ completedAt: -1 }).limit(5).select('serviceType budget completedAt').populate('client', 'name');
    res.render('painter-profile', {
      title: `${painter.name} - دهان محترف - بينتيلو برو`,
      painter, recentJobs, user: req.session.user || null,
      isVerified: painter.verification.status === 'verified',
      isActive: painter.isActive, lang: 'ar'
    });
  } catch (error) {
    console.error('Public painter profile error:', error);
    if (error.name === 'CastError') return res.status(400).render('error', {
      title: 'معرف دهان غير صالح', message: 'صيغة معرف الدهان غير صالحة.', lang: 'ar'
    });
    res.status(500).render('error', {
      title: 'خطأ', message: 'حدث خطأ أثناء تحميل ملف الدهان.', lang: 'ar'
    });
  }
});

// ==================== PRODUCT ROUTES (explicit before /:id) ====================
// Product listing page (English)
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).sort({ createdAt: -1 });
    res.render('products/index', { products });   // create this view if needed
  } catch (err) {
    res.status(500).send('Server Error');
  }
});


// Product listing page (Arabic) – prevents /products/ar from hitting /:id
router.get('/products/ar', async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).sort({ createdAt: -1 });

    // Generate PageView event ID
    const userData = getCleanUserData(req);
    const pageViewId = generateEventId();

    // Server-side PageView event
    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'PageView',
        eventId: pageViewId,
        userData,
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    res.render('ar/products/index', {
      products,
      metaEventIdPageView: pageViewId,   // <-- pass it to the view
      user: req.session.user || null,
      sessionPainter: req.session.painter || null
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).render('404');

    // ----- Related products -----
    const relatedProducts = await Product.find({
      featured: true,
      _id: { $ne: product._id }       // exclude the current product
    })
      .sort({ createdAt: -1 })
      .limit(8);

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
// ✅ NEW – ViewContent (server side)
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

    res.render('ar/products/product', {
      title: product.name + ' - Paintello Pro',
      product,
      relatedProducts,               // 👈 now passed to the view
      metaEventIdPageView: pageViewId,
      metaEventIdView: viewContentId,
      metaEventIdCart: addToCartId,
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      whatsappPhone: process.env.WHATSAPP_PHONE || '213796530868',
    });
  } catch (error) {
    console.error('Product detail error:', error);
    if (error.name === 'CastError') {
      return res.status(400).send('Invalid product ID');
    }
    res.status(500).send('Server Error');
  }
});

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

// -------------------- CHECKOUT GET (render page) --------------------
router.get('/checkout', async (req, res) => {
  // If cart is empty or not set, redirect to products page
  if (!req.session.cart || !req.session.cart.totalQty) {
    return res.redirect('/products'); // or home
  }

  try {
    const cart = req.session.cart;
    const userData = getCleanUserData(req);
    const pageViewId = generateEventId();

    // Pixel PageView (server)
    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'PageView',
        eventId: pageViewId,
        userData,
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    // Render the Arabic checkout page
    res.render('checkout', {   // or 'ar/checkout' if you separate views
      title: 'إتمام الطلب - Paintello Pro',
      cart: cart,
      user: req.session.user || null,
      sessionPainter: req.session.painter || null,
      metaEventIdPageView: pageViewId
    });
  } catch (error) {
    console.error('Checkout GET error:', error);
    res.redirect('/');
  }
});

// -------------------- CHECKOUT POST (process order) --------------------
router.post('/checkout', async (req, res) => {
  // 1. Validate session cart
  if (!req.session.cart || !req.session.cart.totalQty) {
    return res.redirect('/products');
  }

  // 2. Grab the cart ONCE and keep a reference
  const cart = req.session.cart;   // 👈 declare early

  // 3. Get form fields
  const {
    firstName, lastName, address, city, commune,
    numero, paymentMethod, shippingFee, deliveryDelay
  } = req.body;

  // 4. Read updated quantities
  const newQtys = req.body.qtys || {};
  let adjustedTotalPrice = 0;
  let adjustedTotalQty = 0;

  // 5. Recalculate totals based on submitted quantities
  for (const id in cart.items) {
    const item = cart.items[id];
    const qty = parseInt(newQtys[id]) || item.qty;
    item.qty = qty;
    item.price = item.item.price * qty;   // update line total
    adjustedTotalPrice += item.price;
    adjustedTotalQty += qty;
  }

  cart.totalQty = adjustedTotalQty;
  cart.totalPrice = adjustedTotalPrice;

  const shipping = parseFloat(shippingFee) || 0;
  const finalTotal = adjustedTotalPrice + shipping;

  // Clean phone
  const cleanNumero = '213' + numero.replace(/^0+/, '').replace(/\D/g, '');

  // Meta event
  const initiateCheckoutId = generateEventId();
  const userData = getCleanUserData(req);

  // ---------- COD ----------
  if (paymentMethod === 'cod') {
    try {
      const order = new ProductOrder({
        user: req.session.user?._id || null,
        guest: {
          firstName,
          lastName,
          numero: cleanNumero,
          address,
          city,
          commune
        },
        cart: {
          items: Object.values(cart.items).map(item => ({
            product: item.item._id,
            name: item.item.name,
            price: item.item.price,
            image: item.item.image,
            qty: item.qty
          })),
          totalQty: cart.totalQty,
          totalPrice: cart.totalPrice
        },
        shippingFee: shipping,
        deliveryDelay: deliveryDelay || '',
        totalWithShipping: finalTotal,
        paymentMethod: 'cod',
        status: 'pending',
        metaUserData: userData || {}
      });

      await order.save();

      // Pixel InitiateCheckout
      if (userData) {
        await sendMetaCAPIEvent({
          eventName: 'InitiateCheckout',
          eventId: initiateCheckoutId,
          userData,
          customData: {
            content_ids: Object.keys(cart.items),
            contents: Object.values(cart.items).map(item => ({
              id: item.item._id.toString(),
              quantity: item.qty,
              item_price: item.item.price
            })),
            value: finalTotal,
            currency: 'DZD',
            num_items: cart.totalQty
          },
          eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE
        });
      }
await sendTelegramMessage(
  `🛒 <b>طلب جديد</b> — ${order.guest.firstName} ${order.guest.lastName}\n` +
  `📱 الهاتف: ${order.guest.numero}\n` +
  `📍 العنوان: ${order.guest.address}, ${order.guest.commune}, ${order.guest.city}\n` +
  `💰 المجموع: ${order.totalWithShipping} دج\n` +
  `🚚 التوصيل: ${order.deliveryDelay}\n` +
  `📦 الحالة: ${order.status}\n` +
  `💳 الدفع: ${order.paymentMethod === 'chargily' ? 'CIB / الذهبية' : 'الدفع عند الاستلام'}\n` +
  `🔗 رابط: https://www.paintello.uk/order/deliver/${order._id}?secret=mySuperSecret123`
);
      // Clear cart
      req.session.cart = null;

      // Store confirmation data
      req.session.confirmationData = {
        paymentMethod: 'cod',
        eventId: initiateCheckoutId,
        eventName: 'InitiateCheckout',
        firstName,
        lastName,
        numero: cleanNumero,
        address,
        city,
        commune,
        cartTotal: cart.totalPrice,
        shippingFee: shipping,
        deliveryDelay: deliveryDelay || '',
        totalPrice: finalTotal,
        cartItems: Object.values(cart.items)
      };

      return res.redirect('/confirmation');
    } catch (error) {
      console.error('COD order error:', error);
      req.flash('error', 'حدث خطأ أثناء معالجة الطلب.');
      return res.redirect('/checkout');
    }
  }

  // ---------- Online Payment (Chargily) ----------
  if (paymentMethod === 'chargily') {
    req.session.pendingOrder = {
      cart: req.session.cart,
      firstName,
      lastName,
      address,
      city,
      commune,
      shippingFee: shipping,
      shippingDelay: deliveryDelay || '',
      finalTotal,
      rawNumero: numero,
      user: req.session.user || null,
      savedUserData: userData || {}
    };

    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const payment = await createPayment({
        amount: Math.round(finalTotal),
        currency: 'dzd',
        success_url: `${baseUrl}/payment/success`,
        failure_url: `${baseUrl}/checkout?payment=failed`,
        metadata: { session_id: req.sessionID }
      });
      return res.redirect(payment.checkout_url);
    } catch (error) {
      console.error('Chargily payment creation error:', error);
      req.flash('error', 'فشل إنشاء عملية الدفع. حاول مرة أخرى.');
      return res.redirect('/checkout');
    }
  }

  req.flash('error', 'طريقة دفع غير معروفة.');
  return res.redirect('/checkout');
});
    
// In confirmation route (GET)
router.get('/confirmation', async (req, res) => {
  const data = req.session.confirmationData;
  if (!data) return res.redirect('/');
  // Render confirmation.ejs with data, and also pass eventId for pixel
  res.render('confirmation', { ...data, user: req.session.user });
});

// Admin delivery confirmation route
router.get('/order/deliver/:orderId', async (req, res) => {
  // Basic secret protection
  if (req.query.secret !== 'mySuperSecret123') {
    return res.status(403).send('Access denied');
  }

  try {
    // ✅ Use ProductOrder instead of Order
    const order = await ProductOrder.findById(req.params.orderId);
    if (!order) return res.status(404).send('Order not found');

    if (order.status === 'delivered') {
      return res.send('Order already marked as delivered.');
    }

    // Manually update the status (ProductOrder doesn't have updateStatus method)
    order.status = 'delivered';
    await order.save();

    // Trigger the Purchase CAPI event
    await sendPurchaseForDeliveredCOD(order);

    res.send(`Order ${order._id} marked as delivered. Purchase event sent.`);
  } catch (err) {
    console.error('Error delivering order:', err);
    res.status(500).send('Server error');
  }
});
module.exports = router;
    

