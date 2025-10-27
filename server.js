const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const app = express();

// MongoDB Connection with uppercase database name
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://paintellocontact_db_user:nOqgkEfw3ZeCQZXk@paintello-pro.kxlmuok.mongodb.net/PAINTELLO-PRO?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB...');

// Improved MongoDB connection with better error handling
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB Connected successfully to PAINTELLO-PRO database');
})
.catch(err => {
  console.log('❌ MongoDB connection error:', err.message);
  // Don't exit the process, let the app continue without database
});

// Session configuration with better error handling
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'paintello-pro-super-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
  }
};

// Only add MongoStore if MongoDB is connected
if (mongoose.connection.readyState === 1) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  });
} else {
  console.log('⚠️  Using memory session store (MongoDB not available)');
}

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

// Import and use routes with better error handling
const loadRoute = (routePath, routeName) => {
  try {
    const route = require(routePath);
    app.use(routePath.includes('auth') ? '/auth' : 
            routePath.includes('client') ? '/client' :
            routePath.includes('painter') ? '/painter' :
            routePath.includes('admin') ? '/admin' : '/api', route);
    console.log(`✅ ${routeName} routes loaded`);
  } catch (error) {
    console.log(`⚠️  ${routeName} routes not loaded:`, error.message);
    // Create basic placeholder route
    const router = express.Router();
    router.get('*', (req, res) => {
      res.status(501).render('shared/error', {
        title: 'Feature Not Implemented',
        error: 'This feature is currently under development.'
      });
    });
    app.use(routePath.includes('auth') ? '/auth' : 
            routePath.includes('client') ? '/client' :
            routePath.includes('painter') ? '/painter' :
            routePath.includes('admin') ? '/admin' : '/api', router);
  }
};

// Load all routes
loadRoute('./routes/auth', 'Auth');
loadRoute('./routes/client', 'Client');
loadRoute('./routes/painter', 'Painter');
loadRoute('./routes/admin', 'Admin');
loadRoute('./routes/api', 'API');

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

// Health check endpoint (important for Heroku)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'OK', 
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple test route
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Paintello Pro server is running!',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎨 Paintello Pro Server started successfully!`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
