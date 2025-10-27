const express = require('express');
const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Admin Dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    title: 'Admin Dashboard - Paintello Pro',
    stats: {
      totalUsers: 0,
      totalPainters: 0,
      totalOrders: 0,
      totalRevenue: 0
    },
    recentActivities: []
  });
});

// Painter Management
router.get('/painters', requireAdmin, (req, res) => {
  res.render('admin/painters', {
    title: 'Manage Painters - Paintello Pro',
    painters: []
  });
});

// Order Management
router.get('/orders', requireAdmin, (req, res) => {
  res.render('admin/orders', {
    title: 'Manage Orders - Paintello Pro',
    orders: []
  });
});

// Store Management
router.get('/store-management', requireAdmin, (req, res) => {
  res.render('admin/store-management/products', {
    title: 'Store Management - Paintello Pro',
    products: []
  });
});

module.exports = router;
