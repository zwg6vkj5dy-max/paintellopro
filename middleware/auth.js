module.exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect('/signin');
};

module.exports.isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).send('Forbidden');
};

module.exports.ensureRole = (roles) => (req, res, next) => {
  const ok = Array.isArray(roles) ? roles.includes(req.user?.role) : req.user?.role === roles;
  if (!ok) return res.status(403).send('Forbidden');
  next();
};
