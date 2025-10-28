const express = require('express');
const router = express.Router();

const Painter = require('../models/Painter');
const bcrypt = require('bcrypt');
const { uploadIdCard, deleteFromCloudinary } = require('../utils/cloudinary');

// Painter Registration Routes
router.get('/auth/register-painter', (req, res) => {
  res.render('auth/register-painter', {
    title: 'Join as Painter - Paintello Pro',
    wilayas: wilayas,
    oldInput: req.flash('oldInput')[0] || {},
    error: req.flash('error')[0],
    success: req.flash('success')[0]
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
        wilayaNumber: parseInt(wilayaNumber),
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

    req.flash('error', 'An error occurred during registration. Please try again.');
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

module.exports = router;
    

