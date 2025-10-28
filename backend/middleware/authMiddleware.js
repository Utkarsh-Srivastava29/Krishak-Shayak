const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Check if user is a seller
exports.seller = (req, res, next) => {
  if (req.user && req.user.userType === 'seller') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a seller' });
  }
};

// Check if user is a buyer
exports.buyer = (req, res, next) => {
  if (req.user && req.user.userType === 'buyer') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a buyer' });
  }
};