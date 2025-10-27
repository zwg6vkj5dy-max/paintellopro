var express = require('express')
var router = express.Router()
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Painter = require('../models/Painter');
// Client submits a project request
router.post('/project', async (req, res) => {
  try {
    const project = new Project({
      client: req.body.clientId,
      details: req.body.details
    });
    await project.save();
    res.redirect('/client/projects');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// View client projects
router.get('/projects', async (req, res) => {
  const projects = await Project.find({ client: req.user._id }).populate('painter');
  res.render('client/projects', { projects });
});
// Painter dashboard
router.get('/projects', async (req, res) => {
  const projects = await Project.find({ painter: req.user._id });
  res.render('painter/projects', { projects });
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

// Assign painter to project
router.post('/assign/:projectId/:painterId', async (req, res) => {
  await Project.findByIdAndUpdate(req.params.projectId, { 
    painter: req.params.painterId, 
    status: 'matched' 
  });
  res.redirect('/admin/projects');
});


module.exports = router;

    

