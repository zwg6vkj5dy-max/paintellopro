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

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'paintello-pro-fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
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
