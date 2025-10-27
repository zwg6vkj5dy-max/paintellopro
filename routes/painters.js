const express = require('express');
const router = express.Router();

// Painter Dashboard
router.get('/dashboard', (req, res) => {
  res.render('painter/dashboard', {
    title: 'Painter Dashboard - Paintello Pro',
    recentJobs: [],
    stats: {}
  });
});

// Painter Profile
router.get('/profile', (req, res) => {
  res.render('painter/profile', {
    title: 'Profile - Paintello Pro',
    painter: {},
    wilayas: require('../utils/wilayas')
  });
});

// Painter Orders
router.get('/orders', (req, res) => {
  res.render('painter/orders', {
    title: 'My Jobs - Paintello Pro',
    orders: [],
    status: 'all',
    currentPage: 1,
    totalPages: 1
  });
});

// Painter Portfolio
router.get('/portfolio', (req, res) => {
  res.render('painter/portfolio', {
    title: 'Portfolio - Paintello Pro',
    painter: {}
  });
});

// Painter Store
router.get('/store', (req, res) => {
  res.render('painter/store/products', {
    title: 'Team Store - Paintello Pro',
    products: [],
    category: 'all',
    cartCount: 0
  });
});

module.exports = router;
