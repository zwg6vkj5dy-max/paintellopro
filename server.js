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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://paintellocontact_db_user:nOqgkEfw3ZeCQZXk@paintello-pro.kxlmuok.mongodb.net/paintello-pro?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected successfully to Paintello Pro database');
})
.catch(err => {
  console.log('❌ MongoDB connection error:', err);
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'paintello-pro-super-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}));

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

// Import and use routes
try {
  const authRoutes = require('./routes/auth');
  app.use('/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.log('⚠️  Auth routes not loaded:', error.message);
}

try {
  const clientRoutes = require('./routes/client');
  app.use('/client', clientRoutes);
  console.log('✅ Client routes loaded');
} catch (error) {
  console.log('⚠️  Client routes not loaded:', error.message);
}

try {
  const painterRoutes = require('./routes/painter');
  app.use('/painter', painterRoutes);
  console.log('✅ Painter routes loaded');
} catch (error) {
  console.log('⚠️  Painter routes not loaded:', error.message);
}

try {
  const adminRoutes = require('./routes/admin');
  app.use('/admin', adminRoutes);
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.log('⚠️  Admin routes not loaded:', error.message);
}

try {
  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);
  console.log('✅ API routes loaded');
} catch (error) {
  console.log('⚠️  API routes not loaded:', error.message);
}

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
    message: 'Paintello Pro is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.stack);
  res.status(500).render('shared/error', { 
    title: 'Server Error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('shared/404', { 
    title: 'Page Not Found'
  });
});

// Only start server if this file is run directly (not when required)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🎨 Paintello Pro Server started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
