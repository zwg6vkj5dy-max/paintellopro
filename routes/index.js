const express = require('express');
const router = express.Router();
const wilayas = require('../utils/wilayas');
const Painter = require('../models/Painter');
const bcrypt = require('bcrypt');
const { uploadIdCard, deleteFromCloudinary } = require('../utils/cloudinary');
// Painter Login Page - FIXED PATH
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
  console.log('🔍 Painter login page accessed - Session check:');
  console.log('   req.session.painter:', req.session.painter);
  console.log('   req.session.user:', req.session.user);
  
  // Check if user is logged in as painter (in either session.user or session.painter)
  const isPainterLoggedIn = (req.session.painter && req.session.painter.role === 'painter') || 
                           (req.session.user && req.session.user.role === 'painter');
  
  if (isPainterLoggedIn) {
    console.log('✅ Painter already logged in, redirecting to dashboard');
    return res.redirect('/painter/dashboard');
  }
  
res.render('auth/login-painter', { 
  title: 'Painter Login - Paintello Pro',
  user: req.session.user || null,
  success: req.flash('success'),
  error: req.flash('error'),
  warning: req.flash('warning'),
  info: req.flash('info'),
  oldInput: req.flash('oldInput')[0] || {}
});

});
// Painter Login Handler - FIXED PATH
router.post('/auth/login-painter', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Store form data in case of error
    const formData = { email };

    // Basic validation
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      req.flash('oldInput', formData);
      return res.redirect('/painter/dashboard');
    }

    // Find painter by email
    const painter = await Painter.findOne({ email });
    if (!painter) {
      req.flash('error', 'Invalid email or password');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Check password
    const isMatch = await painter.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Check if painter is verified
    if (painter.verification.status !== 'verified') {
      req.flash('error', 'Your account is pending verification. We will contact you once verified.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Check if painter is active
    if (!painter.isActive) {
      req.flash('error', 'Your account has been deactivated. Please contact support.');
      req.flash('oldInput', formData);
      return res.redirect('/painter/dashboard');
    }

    // Set painter session
    req.session.painter = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter'
    };

  // Force session save before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Login failed due to session error');
        return res.redirect('/auth/login-painter');
      }
      
      console.log(`✅ Painter logged in: ${painter.name} (${painter.email})`);
      console.log('🔍 Session after login:', req.session.painter);
      req.flash('success', 'Welcome back to Paintello Pro!');
      res.redirect('/painter/dashboard');
    });

  } catch (error) {
    console.error('Painter login error:', error);
    req.flash('error', 'An error occurred during login');
    req.flash('oldInput', req.body);
    res.redirect('/auth/login-painter');
  }
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
    title: 'Join as Painter',
    wilayas: wilayas,
    oldInput: req.flash('oldInput')[0] || {},
    error: req.flash('error')[0],
    success: req.flash('success')[0],
    // Add these variables that your header expects
    user: req.user || null,
    painter: req.painter || null,
    messages: [] // Empty array since you're using flash messages instead
  });
});

// Handle painter registration with Cloudinary ID card upload
router.post('/auth/login-painter', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Store form data in case of error
    const formData = { email };

    // Basic validation
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Find painter by email
    const painter = await Painter.findOne({ email });
    
    // Case 1: No account found - redirect to register
    if (!painter) {
      req.flash('info', 'No account found with this email. Please register as a painter.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Check password
    const isMatch = await painter.comparePassword(password);
    
    // Case 2: Wrong password - redirect to register (since they might not remember they have an account)
    if (!isMatch) {
      req.flash('error', 'Invalid password. If you forgot your password, please contact support or register a new account.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Case 3: Account not verified - show message on login page
    if (painter.verification.status !== 'verified') {
      let message = '';
      switch (painter.verification.status) {
        case 'pending':
          message = 'Your account is pending verification. We will contact you once verified.';
          break;
        case 'rejected':
          message = 'Your verification was rejected. Please contact support for more information.';
          break;
        default:
          message = 'Your account requires verification before you can login.';
      }
      req.flash('warning', message);
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Case 4: Account not active - show message on login page
    if (!painter.isActive) {
      req.flash('error', 'Your account has been deactivated. Please contact support to reactivate your account.');
      req.flash('oldInput', formData);
      return res.redirect('/auth/login-painter');
    }

    // Case 5: Everything is good - set session and redirect to dashboard
    req.session.painter = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter',
      profilePicture: painter.profilePicture,
      verification: painter.verification
    };

    // Also set user session for header compatibility
    req.session.user = {
      _id: painter._id,
      name: painter.name,
      email: painter.email,
      phone: painter.phone,
      role: 'painter'
    };

    // Force session save before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Login failed due to session error');
        return res.redirect('/auth/login-painter');
      }
      
      console.log(`✅ Painter logged in: ${painter.name} (${painter.email})`);
      console.log('🔍 Session after login:', req.session.painter);
      req.flash('success', `Welcome back, ${painter.name}!`);
      res.redirect('/painter/dashboard');
    });

  } catch (error) {
    console.error('Painter login error:', error);
    req.flash('error', 'An error occurred during login. Please try again.');
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
    

