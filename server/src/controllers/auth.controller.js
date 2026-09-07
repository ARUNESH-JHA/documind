const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// ─── Helper: generate tokens ─────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

// ─── Helper: set refresh token cookie ────────────
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password });
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Store hashed refresh token
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    message: 'Registered successfully',
    accessToken,
    user: { id: user._id, name: user.name, email: user.email },
  });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const { accessToken, refreshToken } = generateTokens(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  setRefreshCookie(res, refreshToken);

  res.json({
    message: 'Login successful',
    accessToken,
    user: { id: user._id, name: user.name, email: user.email },
  });
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    return res.status(403).json({ message: 'Refresh token reuse detected' });
  }

  const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);
  user.refreshToken = newRefresh;
  await user.save({ validateBeforeSave: false });
  setRefreshCookie(res, newRefresh);

  res.json({ accessToken });
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const decoded = jwt.decode(token);
    if (decoded?.id) {
      await User.findByIdAndUpdate(decoded.id, { refreshToken: '' });
    }
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
};
