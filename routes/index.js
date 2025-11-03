const express = require('express');
const router = express.Router();
const wilayas = require('../utils/wilayas');
const Painter = require('../models/Painter');
const bcrypt = require('bcrypt');
const { uploadIdCard, deleteFromCloudinary } = require('../utils/cloudinary');
// Painter Login Page - FIXED PATH
// Route pour la recherche des peintres en arabe
app.get('/ar/painters', async (req, res) => {
  try {
    const { wilaya, specialization, minRating, maxPrice, minExperience, availability, sort = 'rating' } = req.query;
    
    // Logique de recherche identique mais avec lang='ar'
    const painters = await Painter.find(query)
      .select('name experience pricePerSqm specialization rating completedJobs profilePicture location portfolio verification availability')
      .sort(sortOptions);

    res.render('painters-ar', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: painters,
      wilayas: wilayas,
      query: req.query,
      user: req.session.user || null,
      lang: 'ar'
    });
  } catch (error) {
    console.error('Public painters search error:', error);
    res.render('painters-ar', {
      title: 'ابحث عن دهانين - بينتيلو برو',
      painters: [],
      wilayas: wilayas,
      query: {},
      error: 'خطأ في تحميل الدهانين',
      lang: 'ar'
    });
  }
});
// Home page route
router.get('/', async (req, res) => {
  try {
    // Get featured painters for the home page
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

// Arabic home page route
router.get('/ar', async (req, res) => {
  try {
    // Get featured painters for the home page
    const featuredPainters = await Painter.find({
      'verification.status': 'verified',
      'isActive': true
    })
    .sort({ rating: -1, completedJobs: -1 })
    .limit(6)
    .select('name experience pricePerSqm specialization rating completedJobs profilePicture location');

    res.render('ar/index', {
      title: 'بينتيلو برو - Find Professional Painters in Algeria',
      featuredPainters: featuredPainters,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Arabic home page error:', error);
    res.render('ar/index', {
      title: 'بينتيلو برو - Find Professional Painters in Algeria',
      featuredPainters: [],
      user: req.session.user || null
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

// Painter Login Page - FIXED VERSION
router.get('/auth/login-painter', (req, res) => {
  // Prevent logged-in users from seeing login page again
  if (req.session.painter && req.session.painter.role === 'painter') {
    return res.redirect('/painter/dashboard');
  }

  res.render('auth/login-painter', {
    title: 'Painter Login - Paintello Pro'
  });
});


// Client Login Page - FIXED PATH
router.get('/auth/login', (req, res) => {
  res.render('auth/login', { 
    title: 'Login - Paintello Pro',
    oldInput: req.flash('oldInput')[0] || {},
    error: req.flash('error')[0],
    success: req.flash('success')[0],
    user: req.user || null,
    painter: req.session.painter || null
  });
});
// Painter Registration Routes
router.get('/auth/register-painter', (req, res) => {
  res.render('auth/register-painter', {
    title: 'Join as Painter - Paintello Pro',
    wilayas, // all wilayas list
  });
});

// 🎨 Painter Registration (with flash messages)
router.post('/auth/register-painter', uploadIdCard.single('idCard'), async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      confirmPassword,
      experience,
      pricePerSqm,
      specialization,
      wilaya,
      wilayaNumber,
      address
    } = req.body;

    // Store old input for re-rendering form
    const oldInput = req.body;

    // 🟠 1. Validate required fields
    if (!name || !phone || !email || !password || !confirmPassword || !experience || !pricePerSqm || !specialization || !wilaya || !address) {
      req.flash('error', '⚠️ Please fill in all required fields.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }

    // 🟠 2. Validate password match
    if (password !== confirmPassword) {
      req.flash('error', '❌ Passwords do not match. Please try again.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }

    // 🟠 3. Check if painter already exists
    const existingPainter = await Painter.findOne({ $or: [{ email }, { phone }] });
    if (existingPainter) {
      req.flash('warning', '⚠️ An account with this email or phone number already exists. Please log in instead.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/login-painter');
    }

    // 🟠 4. Validate ID card upload
    if (!req.file || !req.file.path) {
      req.flash('error', '🪪 Please upload a valid photo of your ID card.');
      req.flash('oldInput', oldInput);
      return res.redirect('/auth/register-painter');
    }

    // 🟠 5. Upload success – Create painter record
    const painter = new Painter({
      name,
      phone,
      email,
      password,
      experience,
      pricePerSqm,
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      location: {
        wilaya,
        wilayaNumber,
        address
      },
      profilePicture: { url: '', public_id: '' },
      idCard: {
        url: req.file.path,
        public_id: req.file.filename
      },
      verification: {
        status: 'pending',
        adminNotes: 'Awaiting verification',
        verifiedAt: null
      },
      isActive: false
    });

    await painter.save();

    // ✅ 6. Registration success
    console.log(`🆕 New painter registered: ${name} (${email})`);
    req.flash('success', '🎉 Registration successful! Your account is pending verification. We will contact you soon.');
    return res.redirect('/auth/login-painter');

  } catch (error) {
    console.error('Painter registration error:', error);

    // 🟥 Cloudinary file cleanup (optional)
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename);
    }

    req.flash('error', '❗ An unexpected error occurred during registration. Please try again.');
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

// Admin route to view painter applications
router.get('/admin/painters', async (req, res) => {
  try {
    const painters = await Painter.find({})
      .select('name email phone experience verification specialization location createdAt')
      .sort({ createdAt: -1 });

    res.render('admin/painters', {
      title: 'Painter Applications',
      painters: painters
    });
  } catch (error) {
    console.error('Error fetching painters:', error);
    req.flash('error', 'Error loading painter applications');
    res.redirect('/admin');
  }
});

// Admin route to view single painter application
router.get('/admin/painters/:id', async (req, res) => {
  try {
    const painter = await Painter.findById(req.params.id);
    
    if (!painter) {
      req.flash('error', 'Painter not found');
      return res.redirect('/admin/painters');
    }

    res.render('admin/painter-detail', {
      title: `Painter: ${painter.name}`,
      painter: painter
    });
  } catch (error) {
    console.error('Error fetching painter:', error);
    req.flash('error', 'Error loading painter details');
    res.redirect('/admin/painters');
  }
});

// Admin route to update verification status
router.post('/admin/painters/:id/verify', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const painter = await Painter.findByIdAndUpdate(
      req.params.id,
      {
        'verification.status': status,
        'verification.adminNotes': adminNotes,
        'verification.verifiedAt': status === 'verified' ? new Date() : null,
        isActive: status === 'verified'
      },
      { new: true }
    );

    req.flash('success', `Painter ${painter.name} has been ${status}`);
    res.redirect('/admin/painters');
  } catch (error) {
    console.error('Error updating painter status:', error);
    req.flash('error', 'Error updating painter status');
    res.redirect('/admin/painters');
  }
});

// Admin route to add portfolio images manually
router.post('/admin/painters/:id/portfolio', async (req, res) => {
  try {
    const { flickrUrl, description } = req.body;
    
    const painter = await Painter.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          portfolio: {
            flickrUrl: flickrUrl,
            description: description,
            uploadedByAdmin: true,
            uploadedAt: new Date()
          }
        }
      },
      { new: true }
    );

    req.flash('success', 'Portfolio image added successfully');
    res.redirect(`/admin/painters/${req.params.id}`);
  } catch (error) {
    console.error('Error adding portfolio image:', error);
    req.flash('error', 'Error adding portfolio image');
    res.redirect(`/admin/painters/${req.params.id}`);
  }
});

// Admin route to delete portfolio image
router.post('/admin/painters/:id/portfolio/delete', async (req, res) => {
  try {
    const { portfolioIndex } = req.body;
    
    const painter = await Painter.findById(req.params.id);
    if (painter && painter.portfolio[portfolioIndex]) {
      painter.portfolio.splice(portfolioIndex, 1);
      await painter.save();
    }

    req.flash('success', 'Portfolio image removed');
    res.redirect(`/admin/painters/${req.params.id}`);
  } catch (error) {
    console.error('Error removing portfolio image:', error);
    req.flash('error', 'Error removing portfolio image');
    res.redirect(`/admin/painters/${req.params.id}`);
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
    

