const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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

// Load routes dynamically
const loadRoutes = (routePath, routeFile) => {
  const fullPath = path.join(__dirname, routePath, routeFile);
  if (fs.existsSync(fullPath)) {
    try {
      return require(fullPath);
    } catch (error) {
      console.log(`⚠️  Route file ${routeFile} has errors:`, error.message);
      return null;
    }
  } else {
    console.log(`⚠️  Route file ${routeFile} not found, creating placeholder`);
    // Create a basic router for missing files
    const router = express.Router();
    router.get('*', (req, res) => {
      res.status(501).render('shared/error', {
        title: 'Feature Not Implemented',
        error: 'This feature is currently under development.'
      });
    });
    return router;
  }
};

// Load all routes
const authRoutes = loadRoutes('routes', 'auth.js');
const clientRoutes = loadRoutes('routes', 'client.js');
const painterRoutes = loadRoutes('routes', 'painter.js');
const adminRoutes = loadRoutes('routes', 'admin.js');
const apiRoutes = loadRoutes('routes', 'api.js');

// Use routes if they exist
if (authRoutes) app.use('/auth', authRoutes);
if (clientRoutes) app.use('/client', clientRoutes);
if (painterRoutes) app.use('/painter', painterRoutes);
if (adminRoutes) app.use('/admin', adminRoutes);
if (apiRoutes) app.use('/api', apiRoutes);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎨 Paintello Pro Server started successfully!`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
});
