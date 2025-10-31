require('./server-setup'); // Add this at the very top

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();



const app = express();

// MongoDB Connection with your specific URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paintello';

console.log('🔧 Starting Paintello Pro Server...');
console.log('   Environment:', process.env.NODE_ENV);
console.log('   MongoDB:', MONGODB_URI ? 'Configured' : 'Not configured');
console.log('   Cloudinary:', process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not configured');

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully to PAINTELLO-PRO database');
  console.log('   Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('   Please check your MONGODB_URI in Heroku config vars');
  process.exit(1);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Session configuration for production
// Trust Heroku proxy
app.set('trust proxy', 1);
// Updated Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'paintello-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));


// Flash messages
// Flash messages
app.use(flash());

// Global variables for templates - FIXED VERSION
app.use((req, res, next) => {
  // req.flash() returns an array, we need the first element
  res.locals.success = req.flash('success')[0];
  res.locals.error = req.flash('error')[0];
  res.locals.warning = req.flash('warning')[0];
  res.locals.info = req.flash('info')[0];
  res.locals.currentUser = req.user;
  res.locals.currentPainter = req.session.painter;
  res.locals.isProduction = process.env.NODE_ENV === 'production';
  next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);
// Mount public routes
const publicRoutes = require('./routes/public');
app.use('/', publicRoutes);
// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const cloudinaryStatus = process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not configured';
  
  res.json({
    status: 'OK',
    app: 'Paintello Pro',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      status: dbStatus,
      name: mongoose.connection.db?.databaseName || 'Unknown'
    },
    cloudinary: cloudinaryStatus,
    session: req.sessionID ? 'Active' : 'Inactive'
  });
});

// Root route
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Paintello Pro - Professional Painter Platform',
    cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});
// Temporary logout route in main app file
app.get('/index/logout', (req, res) => {
  console.log('🚪 Logging out user...');
  
  const userName = req.session.user?.name || req.session.painter?.name || 'User';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/painter/dashboard');
    }
    
    res.clearCookie('connect.sid');
    console.log('✅ Logout successful for:', userName);
    res.redirect('/');
  });
});

app.post('/index/logout', (req, res) => {
  console.log('🚪 POST Logout...');
  
  const userName = req.session.user?.name || req.session.painter?.name || 'User';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/painter/dashboard');
    }
    
    res.clearCookie('connect.sid');
    console.log('✅ POST Logout successful for:', userName);
    res.redirect('/');
  });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.message);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'File too large. Maximum size is 2MB.');
    return res.redirect('back');
  }
  
  if (err.message.includes('image files')) {
    req.flash('error', 'Only image files are allowed.');
    return res.redirect('back');
  }
  
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong! Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    error: {}
  });
});

// Server startup
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Paintello Pro Server started successfully!`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️ Database: PAINTELLO-PRO`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Ready for ID uploads' : 'Not configured'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
