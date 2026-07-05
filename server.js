require('./server-setup'); // Only keep this line if the file actually exists

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// MongoDB URI
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
  
 // --- SEED A FEATURED PRODUCT IF NONE EXISTS ---
  try {
    const existingFeatured = await Product.countDocuments({ featured: true });
    if (existingFeatured === 0) {
      await Product.create({
        name: 'دهان بريميوم أبيض',
        description: 'دهان داخلي عالي الجودة، سهل التطبيق، يجف بسرعة ويعطي لمسة نهائية ناعمة. مثالي لجميع الغرف.',
        price: 1200,
        image: 'https://live.staticflickr.com/65535/55343397132_1ae9c890e0_b.jpg',
        category: 'paint',
        featured: true
      });
      console.log('🌱 Default featured product seeded');
    } else {
      console.log('✅ Featured products already exist');
    }
  } catch (seedErr) {
    console.error('⚠️ Seeding warning:', seedErr.message);
  }
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('   Please check your MONGODB_URI in environment variables');
  process.exit(1);
});
// ---------------- FIX: Handle both ESM and CommonJS exports of connect-mongo ----------------
let MongoStoreModule = require('connect-mongo');
// Support ESM default export (v4+ when required via CommonJS)
let MongoStore = MongoStoreModule.default || MongoStoreModule;

let sessionStore;

if (typeof MongoStore.create === 'function') {
  // ----- connect-mongo v4+ (modern API) -----
  sessionStore = MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60   // 14 days
  });
} else if (typeof MongoStore === 'function') {
  // ----- connect-mongo v3.x or older (legacy API) -----
  const LegacyMongoStore = MongoStore(session);
  sessionStore = new LegacyMongoStore({
    mongooseConnection: mongoose.connection,
    ttl: 14 * 24 * 60 * 60
  });
} else {
  console.error('❌ Unsupported connect-mongo version. Please install connect-mongo@4 or higher.');
  console.error('   Run: npm install connect-mongo@latest');
  process.exit(1);
}
// --------------------------------------------------------------------------------------------

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('trust proxy', 1);

// Session middleware (using the compatible store)
app.use(session({
  secret: process.env.SESSION_SECRET || 'paintello-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Flash middleware
app.use(flash());

// Global locals middleware
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  res.locals.warning = req.flash('warning');
  res.locals.info    = req.flash('info');
  res.locals.oldInput = req.flash('oldInput')[0] || {};
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPainter = req.session.painter || null;
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healty', (req, res) => {
  res.status(200).json({
    status: 'online',
    uptime: process.uptime()
  });
});

// Routes
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

const publicRoutes = require('./routes/public');
app.use('/', publicRoutes);

// Health check
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

// Logout routes
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



module.exports = app; send mze full server
