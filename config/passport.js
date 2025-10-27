const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Local strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return done(null, false, { message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return done(null, false, { message: 'Invalid credentials' });
    return done(null, user);
  } catch (e) {
    return done(e);
  }
}));

// Facebook strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FB_ID,
  clientSecret: process.env.FB_SECRET,
  callbackURL: process.env.FB_CALLBACK,
  profileFields: ['id','emails','name']
}, async (_, __, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        role: 'client',
        name: `${profile.name.givenName} ${profile.name.familyName}`.trim(),
        email,
        passwordHash: ''
      });
    }
    done(null, user);
  } catch (e) {
    done(e);
  }
}));

// Optional Google strategy scaffold
// passport.use(new GoogleStrategy({ ... }, async (accessToken, refreshToken, profile, done) => { ... }));

module.exports = passport;

