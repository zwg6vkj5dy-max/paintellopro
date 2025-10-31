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
// Universal Logout
router.get('/logout', (req, res) => {
  const userName = req.session.user?.name || req.session.painter?.name;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      
      return res.redirect('/');
    }
    
    console.log(`✅ User logged out: ${userName || 'Unknown user'}`);
 
    res.redirect('/');
  });
});
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
    oldInput: req.flash('oldInput')[0] || {},
    error: req.flash('error')[0],
    success: req.flash('success')[0],
    user: req.session.user || null,
    painter: req.session.painter || null,
    messages: []
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
router.post('/auth/register-painter', uploadIdCard.single('idCard'), async (req, res) => {
  try {
    const {
      name, phone, email, password, confirmPassword,
      experience, pricePerSqm, specialization, wilaya,
      wilayaNumber, address
    } = req.body;

    // Store form data in case of error
    const formData = {
      name, phone, email, experience, pricePerSqm,
      specialization, wilaya, wilayaNumber, address
    };

    // Validation
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Validate wilaya number
    const wilayaNum = parseInt(wilayaNumber);
    if (!wilayaNum || isNaN(wilayaNum) || wilayaNum < 1 || wilayaNum > 48) {
      req.flash('error', 'Please select a valid wilaya');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Check if ID card was uploaded
    if (!req.file) {
      req.flash('error', 'ID card photo is required');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Check if user already exists
    const existingUser = await Painter.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      // If user exists but registration failed, delete the uploaded ID card
      if (req.file && req.file.filename) {
        await deleteFromCloudinary(req.file.filename);
      }
      req.flash('error', 'User with this email or phone already exists');
      req.flash('oldInput', formData);
      return res.redirect('/auth/register-painter');
    }

    // Create new painter user
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newPainter = new Painter({
      name,
      phone,
      email,
      password: hashedPassword,
      experience: parseInt(experience),
      pricePerSqm: parseInt(pricePerSqm),
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      location: {
        wilaya,
        wilayaNumber: wilayaNum, // Use the validated number
        address
      },
      verification: {
        idCard: {
          publicId: req.file.filename,
          url: req.file.path,
          uploadedAt: new Date()
        },
        status: 'pending'
      },
      portfolio: [], // Empty portfolio - to be added manually by admin
      userType: 'painter'
    });

    await newPainter.save();

    console.log(`✅ New painter registered: ${name} (${email}) from ${wilaya}`);
    req.flash('success', 'Your application has been submitted successfully! We will review your ID card and contact you soon.');
    res.redirect('/auth/register-painter');

  } catch (error) {
    console.error('Painter registration error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file && req.file.filename) {
      try {
        await deleteFromCloudinary(req.file.filename);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }

    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      req.flash('error', messages.join(', '));
    } else {
      req.flash('error', 'An error occurred during registration. Please try again.');
    }
    
    req.flash('oldInput', req.body);
    res.redirect('/auth/register-painter');
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
module.exports = router;
    

