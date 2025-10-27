var express = require('express')
var router = express.Router()

const Project = require('../models/Project');
const Painter = require('../models/Painter');
const User = require('../models/User');
const { ensureAuth, ensureRole } = require('../middleware/auth');
// Client submits a project request

// New project form
router.get('/project/new', ensureAuth, ensureRole('client'), (req, res) => {
  res.render('client/new-project');
});

// Create project
router.post('/project', ensureAuth, ensureRole('client'), async (req, res) => {
  try {
    const project = new Project({
      client: req.session.user._id,
      details: {
        description: req.body.description,
        roomSize: req.body.roomSize,
        style: req.body.style,
        budget: req.body.budget,
        colors: req.body.colors?.split(',').map(s => s.trim()),
        address: req.body.address
      },
      priceQuoted: req.body.priceQuoted || null
    });
    await project.save();
    req.flash('success', 'Project created. We will match a painter soon.');
    res.redirect('/client/projects');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/client/project/new');
  }
});

// List client projects
router.get('/projects', ensureAuth, ensureRole('client'), async (req, res) => {
  const projects = await Project.find({ client: req.session.user._id }).populate('painter');
  res.render('client/projects', { projects });
});
// Painter project list
router.get('/projects', ensureAuth, ensureRole('painter'), async (req, res) => {
  const projects = await Project.find({ painter: req.session.user._id }).populate('client');
  res.render('painter/projects', { projects });
});

// Update painter profile
router.get('/profile', ensureAuth, ensureRole('painter'), async (req, res) => {
  const painter = await User.findById(req.session.user._id);
  res.render('painter/profile', { painter });
});

router.post('/profile', ensureAuth, ensureRole('painter'), async (req, res) => {
  const { skills, availability } = req.body;
  await User.findByIdAndUpdate(req.session.user._id, {
    $set: {
      'painterProfile.skills': skills?.split(',').map(s => s.trim()),
      'painterProfile.availability': availability === 'true'
    }
  });
  req.flash('success', 'Profile updated.');
  res.redirect('/painter/profile');
});

// Painter updates availability
router.post('/availability', async (req, res) => {
  await Painter.findByIdAndUpdate(req.user._id, { availability: req.body.availability });
  res.redirect('/painter/projects');
});

// Approve painter
router.post('/approve-painter/:id', async (req, res) => {
  await Painter.findByIdAndUpdate(req.params.id, { approved: true });
  res.redirect('/admin/painters');
});

// List non-approved painters
router.get('/painters', ensureAuth, ensureRole('admin'), async (req, res) => {
  const painters = await User.find({ role: 'painter' });
  res.render('admin/painters', { painters });
});

// Approve painter
router.post('/painters/:id/approve', ensureAuth, ensureRole('admin'), async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { 'painterProfile.approved': true });
  req.flash('success', 'Painter approved.');
  res.redirect('/admin/painters');
});

// List projects to match
router.get('/projects', ensureAuth, ensureRole('admin'), async (req, res) => {
  const projects = await Project.find().populate('client painter');
  const painters = await User.find({ role: 'painter', 'painterProfile.approved': true, 'painterProfile.availability': true });
  res.render('admin/projects', { projects, painters });
});

// Assign painter manually
router.post('/projects/:projectId/assign/:painterId', ensureAuth, ensureRole('admin'), async (req, res) => {
  await Project.findByIdAndUpdate(req.params.projectId, { painter: req.params.painterId, status: 'matched' });
  req.flash('success', 'Painter assigned.');
  res.redirect('/admin/projects');
});

// Update project status
router.post('/projects/:projectId/status', ensureAuth, ensureRole('admin'), async (req, res) => {
  const { status } = req.body;
  await Project.findByIdAndUpdate(req.params.projectId, { status });
  req.flash('success', 'Status updated.');
  res.redirect('/admin/projects');
});
// Register (client or painter)
router.get('/register', (req, res) => res.render('auth/register'));
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = new User({ name, email, role });
    await user.setPassword(password);
    // If painter, init empty profile
    if (role === 'painter') user.painterProfile = {};
    await user.save();
    req.flash('success', 'Account created. Please log in.');
    res.redirect('/login');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/register');
  }
});

// Login
router.get('/login', (req, res) => res.render('auth/login'));
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.validatePassword(password))) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    req.session.user = { _id: user._id, role: user.role, name: user.name };
    if (user.role === 'admin') return res.redirect('/admin/projects');
    if (user.role === 'painter') return res.redirect('/painter/projects');
    return res.redirect('/client/projects');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/login');
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});


module.exports = router;

    

