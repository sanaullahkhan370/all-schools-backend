const trackerAuth = (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API key missing' });
  }
  if (apiKey !== process.env.TRACKER_KEY) {
    return res.status(403).json({ success: false, message: 'Invalid API key' });
  }
  req.tracker = { authorized: true };
  return next();
};

module.exports = { trackerAuth };
