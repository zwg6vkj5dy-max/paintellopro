const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Painter = require('../models/Painter');
const Order = require('../models/Order'); // make sure this is imported if used
const bcrypt = require('bcrypt');
const sendMetaCAPIEvent = require('../services/metaCapi');
const getCleanUserData = require('../utils/userData');
const wilayas = require('../utils/wilayas');
const { uploadIdCard, deleteFromCloudinary, checkCloudinaryUrl } = require('../utils/cloudinary');
var Cart = require("../models/cart");
const { createPayment, verifyPayment } = require('../helpers/chargily');
const { sendPurchaseForDeliveredCOD } = require('../helpers/deliveryEvents');
const ProductOrder = require('../models/ProductOrder');
const { sendTelegramMessage } = require('../helpers/telegram');
const { isBotRequest } = require('../utils/botDetection');

const DELIVERY_SECRET = process.env.DELIVERY_SECRET;


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
// FIXED FINAL: AddToCart CAPI deduped with same eventId
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
      }).catch(()=>{});
    }
    res.redirect('/checkout');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


// ==================== HOME ROUTES — FIXED FINAL (no CAPI PageView, bot blocked) ====================
router.get('/', async (req, res) => {
  if (isBotRequest(req, { blockCloudIPs: true })) {
    console.log(`🤖 BLOCKED HOME / UA=${(req.headers['user-agent']||'').slice(0,80)} IP=${req.headers['x-forwarded-for']?.split(',')[0]||req.ip}`);
    return res.status(200).send('ok');
  }
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

// Arabic home — FIXED FINAL
router.get('/ar', async (req, res) => {
  if (isBotRequest(req, { blockCloudIPs: true })) {
    return res.status(200).send('ok');
  }
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

    // FIXED: No CAPI PageView on listing
    const pageViewId = generateEventId();
    if (false) {
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
  if (isBotRequest(req, { blockCloudIPs: true })) {
    return res.status(200).send('ok');
  }
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).render('404');

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }
    })
      .sort({ createdAt: -1 })
      .limit(8);

    // FIXED FINAL: Only ViewContent CAPI (no PageView CAPI)
    const userData = getCleanUserData(req);
    const viewContentId = generateEventId();
    const addToCartId = generateEventId();
    const pageViewId = viewContentId; // for header dedup

    if (userData) {
      sendMetaCAPIEvent({
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
      }).catch(()=>{});
    }

    res.render('ar/products/product', {
      title: product.name + ' - Paintello Pro',
      product,
      relatedProducts,               // now correctly populated by category
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
    if (!req.session?.painter?._id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const painter = await Painter.findById(req.session.painter._id);
    if (!painter) {
      return res.status(404).json({ error: 'Painter not found' });
    }

    const url = painter.profilePicture?.url;
    if (!url) {
      return res.json({ hasProfilePicture: false, message: 'No profile picture found' });
    }

    const isValid = typeof checkCloudinaryUrl === 'function' ? await checkCloudinaryUrl(url) : true;
    res.json({
      hasProfilePicture: true,
      url,
      isValid,
      message: isValid ? 'Profile picture URL is valid' : 'Profile picture URL is invalid'
    });
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

  res.render('auth/login-painter', {
    title: 'Painter Login - Paintello Pro',
    user: req.session.user || null,
    sessionPainter: req.session.painter || null,
    painter: null,
    metaEventIdPageView: pageViewId,
  });
});

// Painter Registration Routes
// ---------- PAINTER REGISTRATION PAGE ----------
router.get('/auth/register-painter', (req, res) => {
  // no need to generate a CompleteRegistration ID here
  const pageViewId = generateEventId();

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
    metaEventIdPageView: pageViewId,   // only PageView remains
    // NO metaEventIdCompleteRegistration here
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

        // ----- CAPI CompleteRegistration (already working) -----
    const userData = getCleanUserData(req);
    // Use the same ID for both CAPI and browser
    const completeRegistrationId = generateEventId();

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

    // ----- Store event ID for browser pixel (will be used on the success page) -----
    req.session.pendingCompleteRegistration = completeRegistrationId;

    // ---- success ----
    console.log(`🆕 New painter registered: ${name} (${email})`);
    req.flash('success', '🎉 Registration successful! Your account is pending verification.');
    // Redirect to the intermediate success page
    return res.redirect('/auth/register-painter/success');

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

router.get('/auth/register-painter/success', (req, res) => {
  const completeRegistrationId = req.session.pendingCompleteRegistration;
  delete req.session.pendingCompleteRegistration;

  if (!completeRegistrationId) {
    return res.redirect('/auth/login-painter');
  }

  res.render('auth/registration-pending', {
    completeRegistrationId,
    loginUrl: '/auth/login-painter',
    fbPixelId: process.env.FB_PIXEL_ID,
    // No need for header partial – it's a standalone page
  });
});

// Handle painter registration with Cloudinary ID card upload
// 🎨 Painter Login Route (Final Flash Version)
router.post('/auth/login-painter', async (req, res) => {
  try {
    const { email, password } = req.body;
    const formData = { email };

    // Validation
    if (!email || !password) {
      req.flash('error', '⚠️ Please enter both your email and password.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Find painter
    const painter = await Painter.findOne({ email });
    if (!painter) {
      req.flash('info', 'ℹ️ No account found with this email. You can register as a painter below.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Check password
    const isMatch = await painter.comparePassword(password);
    if (!isMatch) {
      req.flash('error', '❌ Incorrect password. Please try again or contact support if forgotten.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Verification status
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

    // Account active
    if (!painter.isActive) {
      req.flash('error', '🚫 Your account has been deactivated. Please contact support to reactivate it.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // ----- SUCCESS – Set session -----
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

    // ----- Meta CAPI Lead Event -----
    const leadEventId = generateEventId();
    const userData = getCleanUserData(req);   // Reads from session/user (just set)
    if (userData) {
      await sendMetaCAPIEvent({
        eventName: 'Lead',
        eventId: leadEventId,
        userData,
        customData: {
          content_category: 'painter_login',
          login_method: 'email',
        },
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE,
      });
    }

    // Store event ID for browser pixel (to be used on dashboard)
    req.session.pendingLeadEvent = leadEventId;

    // Save session and redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', '⚠️ Login failed due to session issue. Please try again.');
        return res.redirect('/auth/login-painter');
      }

      console.log(`✅ Painter logged in: ${painter.name} (${painter.email}), Lead event ID: ${leadEventId}`);
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
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/painter/dashboard');
    }

    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// -------------------- CHECKOUT GET (render page) --------------------
router.get('/checkout', async (req, res) => {
  if (isBotRequest(req, { blockCloudIPs: true })) {
    return res.status(200).send('ok');
  }
  if (!req.session.cart || !req.session.cart.totalQty) {
    return res.redirect('/products');
  }
  try {
    const cart = req.session.cart;
    const pageViewId = generateEventId();

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

// -------------------- CHECKOUT POST — FIXED FINAL (lock + non-blocking CAPI) --------------------
router.post('/checkout', async (req, res) => {
  if (req.session.checkoutLock) {
    console.log('⚠ Double checkout blocked');
    return res.redirect('/confirmation');
  }
  req.session.checkoutLock = true;
  await new Promise(r => req.session.save(r));
  // 1. Validate session cart
  if (!req.session.cart || !req.session.cart.totalQty) {
    req.session.checkoutLock = false;
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

  const cleanNumero = getCleanUserData.cleanPhoneNumber(numero);
  if (!firstName || !lastName || !address || !city || !commune || !cleanNumero || !paymentMethod) {
    req.flash('error', 'Please fill in all required checkout fields.');
    return res.redirect('/checkout');
  }
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

      // Pixel InitiateCheckout — non-blocking
      if (userData) {
        sendMetaCAPIEvent({
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
        }).catch(()=>{});
      }
      const deliveryLink = DELIVERY_SECRET
        ? `https://www.paintello.uk/order/deliver/${order._id}?secret=${encodeURIComponent(DELIVERY_SECRET)}`
        : `https://www.paintello.uk/order/deliver/${order._id}`;

      await sendTelegramMessage(
        `🛒 <b>طلب جديد</b> — ${order.guest.firstName} ${order.guest.lastName}\n` +
        `📱 الهاتف: ${order.guest.numero}\n` +
        `📍 العنوان: ${order.guest.address}, ${order.guest.commune}, ${order.guest.city}\n` +
        `💰 المجموع: ${order.totalWithShipping} دج\n` +
        `🚚 التوصيل: ${order.deliveryDelay}\n` +
        `📦 الحالة: ${order.status}\n` +
        `💳 الدفع: ${order.paymentMethod === 'chargily' ? 'CIB / الذهبية' : 'الدفع عند الاستلام'}\n` +
        `🔗 رابط: ${deliveryLink}`
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

      req.session.checkoutLock = false;
      await new Promise(r => req.session.save(r));
      return res.redirect('/confirmation');
    } catch (error) {
      req.session.checkoutLock = false;
      console.error('COD order error:', error);
      req.flash('error', 'حدث خطأ أثناء معالجة الطلب.');
      return res.redirect('/checkout');
    }
  }

  // ---------- Online Payment (Chargily) ----------
  if (paymentMethod === 'chargily') {
    if (userData) {
      sendMetaCAPIEvent({
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
      initiateCheckoutId,
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
        metadata: { session_id: req.sessionID, event_id: initiateCheckoutId }
      });
      return res.redirect(payment.checkout_url);
    } catch (error) {
      console.error('Chargily payment creation error:', error);
      req.flash('error', 'Failed to create payment. Please try again.');
      return res.redirect('/checkout');
    }
  }

  req.flash('error', 'طريقة دفع غير معروفة.');
  return res.redirect('/checkout');
});

router.get('/payment/success', async (req, res) => {
  const pendingOrder = req.session.pendingOrder;
  if (!pendingOrder) return res.redirect('/checkout');

  try {
    const checkoutId = req.query.checkout_id || req.query.payment_id || req.query.id;
    const payment = checkoutId ? await verifyPayment(checkoutId) : null;
    const paymentStatus = String(payment?.status || payment?.data?.status || '').toLowerCase();

    if (payment && paymentStatus && !['paid', 'succeeded', 'success'].includes(paymentStatus)) {
      req.flash('error', 'Payment was not completed.');
      return res.redirect('/checkout');
    }

    const cleanNumero = getCleanUserData.cleanPhoneNumber(pendingOrder.rawNumero);
    const order = new ProductOrder({
      user: pendingOrder.user?._id || null,
      guest: {
        firstName: pendingOrder.firstName,
        lastName: pendingOrder.lastName,
        numero: cleanNumero,
        address: pendingOrder.address,
        city: pendingOrder.city,
        commune: pendingOrder.commune
      },
      cart: {
        items: Object.values(pendingOrder.cart.items).map(item => ({
          product: item.item._id,
          name: item.item.name,
          price: item.item.price,
          image: item.item.image,
          qty: item.qty
        })),
        totalQty: pendingOrder.cart.totalQty,
        totalPrice: pendingOrder.cart.totalPrice
      },
      shippingFee: pendingOrder.shippingFee,
      deliveryDelay: pendingOrder.shippingDelay || '',
      totalWithShipping: pendingOrder.finalTotal,
      paymentMethod: 'chargily',
      status: 'paid',
      metaUserData: pendingOrder.savedUserData || {}
    });

    await order.save();

    if (pendingOrder.savedUserData) {
      sendMetaCAPIEvent({
        eventName: 'Purchase',
        eventId: `purchase_${order._id}`,
        userData: pendingOrder.savedUserData,
        customData: {
          content_ids: Object.keys(pendingOrder.cart.items),
          contents: Object.values(pendingOrder.cart.items).map(item => ({
            id: item.item._id.toString(),
            quantity: item.qty,
            item_price: item.item.price
          })),
          value: pendingOrder.finalTotal,
          currency: 'DZD',
          num_items: pendingOrder.cart.totalQty,
          order_id: order._id.toString()
        },
        eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        testEventCode: req.query.test_event_code || process.env.FB_TEST_EVENT_CODE
      }).catch(()=>{});
    }

    req.session.cart = null;
    req.session.pendingOrder = null;
    req.session.confirmationData = {
      paymentMethod: 'chargily',
      eventId: `purchase_${order._id}`,
      eventName: 'Purchase',
      firstName: pendingOrder.firstName,
      lastName: pendingOrder.lastName,
      numero: cleanNumero,
      address: pendingOrder.address,
      city: pendingOrder.city,
      commune: pendingOrder.commune,
      cartTotal: pendingOrder.cart.totalPrice,
      shippingFee: pendingOrder.shippingFee,
      deliveryDelay: pendingOrder.shippingDelay || '',
      totalPrice: pendingOrder.finalTotal,
      cartItems: Object.values(pendingOrder.cart.items)
    };

    return res.redirect('/confirmation');
  } catch (error) {
    console.error('Chargily success handling error:', error);
    req.flash('error', 'Payment was received, but order confirmation failed. Please contact support.');
    return res.redirect('/checkout');
  }
});
    
router.get('/confirmation', async (req, res) => {
  const data = req.session.confirmationData;
  if (!data) return res.redirect('/');

  delete req.session.confirmationData;
  res.render('confirmation', { ...data, user: req.session.user || null });
});

// Admin delivery confirmation route — FIXED FINAL (block TelegramBot preview)
router.get('/order/deliver/:orderId', async (req, res) => {
  if (!DELIVERY_SECRET || req.query.secret !== DELIVERY_SECRET) {
    return res.status(403).send('Access denied');
  }
  const ua = req.headers['user-agent'] || '';
  if (isBotRequest(req, { blockCloudIPs: true }) || /TelegramBot|facebookexternalhit|WhatsApp|TwitterBot/i.test(ua)) {
    console.log(`🤖 Preview bot blocked from deliver link: ${ua.slice(0,80)}`);
    return res.status(200).send('Link preview - order not marked as delivered. Open in browser to confirm.');
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
    

