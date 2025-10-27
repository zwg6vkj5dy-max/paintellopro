const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const app = express();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://paintellocontact_db_user:nOqgkEfw3ZeCQZXk@paintello-pro.kxlmuok.mongodb.net/PAINTELLO-PRO?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB...');

// MongoDB connection with timeout
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected successfully to PAINTELLO-PRO database');
    return true;
  } catch (err) {
    console.log('❌ MongoDB connection error:', err.message);
    return false;
  }
};

// Initialize DB connection
let dbConnected = false;
connectDB().then(connected => {
  dbConnected = connected;
});

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'paintello-pro-super-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
};

// Use memory store for now to avoid MongoDB session issues
console.log('⚠️  Using memory session store');
app.use(session(sessionConfig));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.painter = req.session.painter || null;
  res.locals.messages = req.session.messages || [];
  req.session.messages = [];
  next();
});

// Simple route loader
const loadRoutes = () => {
  // Auth routes
  try {
    const authRoutes = require('./routes/auth');
    app.use('/auth', authRoutes);
    console.log('✅ Auth routes loaded');
  } catch (error) {
    console.log('❌ Auth routes failed:', error.message);
    app.use('/auth', (req, res) => res.redirect('/'));
  }

  // Client routes
  try {
    const clientRoutes = require('./routes/client');
    app.use('/client', clientRoutes);
    console.log('✅ Client routes loaded');
  } catch (error) {
    console.log('❌ Client routes failed:', error.message);
    app.use('/client', (req, res) => res.redirect('/auth/login'));
  }

  // Painter routes
  try {
    const painterRoutes = require('./routes/painter');
    app.use('/painter', painterRoutes);
    console.log('✅ Painter routes loaded');
  } catch (error) {
    console.log('❌ Painter routes failed:', error.message);
    app.use('/painter', (req, res) => res.redirect('/auth/login'));
  }

  // Admin routes
  try {
    const adminRoutes = require('./routes/admin');
    app.use('/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
  } catch (error) {
    console.log('❌ Admin routes failed:', error.message);
    app.use('/admin', (req, res) => res.redirect('/auth/login'));
  }

  // API routes
  try {
    const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes);
    console.log('✅ API routes loaded');
  } catch (error) {
    console.log('❌ API routes failed:', error.message);
    app.use('/api', (req, res) => res.json({ error: 'API not available' }));
  }
};

// Load all routes
loadRoutes();

// Public routes
app.get('/', (req, res) => {
  res.render('shared/home', { 
    title: 'Paintello Pro - Find Professional Painters in Algeria',
    featuredPainters: [],
    wilayas: require('./utils/wilayas')
  });
});

app.get('/painters', (req, res) => {
  res.render('client/search-painters', { 
    title: 'Find Professional Painters',
    painters: [],
    wilayas: require('./utils/wilayas'),
    query: req.query
  });
});

app.get('/about', (req, res) => {
  res.render('shared/about', { 
    title: 'About Paintello Pro'
  });
});

app.get('/contact', (req, res) => {
  res.render('shared/contact', { 
    title: 'Contact Us - Paintello Pro'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Paintello Pro is running! 🎨',
    version: '1.0.0',
    database: dbConnected ? '✅ Connected' : '❌ Disconnected'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  res.status(500).render('shared/error', { 
    title: 'Server Error',
    error: 'Something went wrong! Please try again later.'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('shared/404', { 
    title: 'Page Not Found'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Paintello Pro Server started successfully!`);
  console.log(`📍 Running on: http://0.0.0.0:${PORT}`);
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://0.0.0.0:${PORT}/test`);
});
