const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { isDbConnected } = require('../config/db');

// In-memory fallback user store for resilient local operation when MongoDB is offline
const inMemoryUsers = new Map();

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  // Simple validation
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (isDbConnected()) {
      // Check if user already exists
      const userExists = await User.findOne({ email: normalizedEmail });

      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user
      const user = await User.create({
        name,
        email: normalizedEmail,
        password,
      });

      if (user) {
        return res.status(201).json({
          token: generateToken(user._id.toString()),
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          },
        });
      } else {
        return res.status(400).json({ message: 'Invalid user data' });
      }
    } else {
      // Fallback in-memory registration
      if (inMemoryUsers.has(normalizedEmail)) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userId = 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const newUser = {
        id: userId,
        name,
        email: normalizedEmail,
        password: hashedPassword,
      };

      inMemoryUsers.set(normalizedEmail, newUser);

      return res.status(201).json({
        token: generateToken(userId),
        user: {
          id: userId,
          name: newUser.name,
          email: newUser.email,
        },
      });
    }
  } catch (error) {
    console.error(`Register Error: ${error.message}`);
    res.status(500).json({ message: 'Server error during registration: ' + error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (isDbConnected()) {
      // Find user in MongoDB
      const user = await User.findOne({ email: normalizedEmail });

      if (user && (await user.matchPassword(password))) {
        return res.json({
          token: generateToken(user._id.toString()),
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          },
        });
      } else {
        return res.status(400).json({ message: 'Invalid email or password' });
      }
    } else {
      // Fallback in-memory authentication
      const user = inMemoryUsers.get(normalizedEmail);

      if (user && (await bcrypt.compare(password, user.password))) {
        return res.json({
          token: generateToken(user.id),
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      } else {
        return res.status(400).json({ message: 'Invalid email or password' });
      }
    }
  } catch (error) {
    console.error(`Login Error: ${error.message}`);
    res.status(500).json({ message: 'Server error during login: ' + error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    if (isDbConnected()) {
      const user = await User.findById(userId).select('-password');
      if (user) {
        return res.json({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        });
      }
    }

    // In-memory or fallback lookup
    for (const [, user] of inMemoryUsers) {
      if (user.id === userId) {
        return res.json({
          id: user.id,
          name: user.name,
          email: user.email,
        });
      }
    }

    // Default mock response for decoded token if user restarted server
    res.json({
      id: userId,
      name: 'Interview Candidate',
      email: 'candidate@example.com',
    });
  } catch (error) {
    console.error(`Get Profile Error: ${error.message}`);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  const { name, email, password } = req.body;
  const userId = req.user.id;

  try {
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (email && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      // Simple email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      updates.email = normalizedEmail;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    if (isDbConnected()) {
      // Check email uniqueness if email is being updated
      if (updates.email) {
        const existing = await User.findOne({ email: updates.email, _id: { $ne: userId } });
        if (existing) {
          return res.status(400).json({ message: 'Email is already in use by another account' });
        }
      }

      const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
      if (user) {
        return res.json({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        });
      }
      return res.status(404).json({ message: 'User not found' });
    } else {
      // Fallback in-memory update
      let targetEntry = null;
      for (const [entryEmail, entryUser] of inMemoryUsers) {
        if (entryUser.id === userId) {
          targetEntry = { key: entryEmail, user: entryUser };
          break;
        }
      }

      if (!targetEntry) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check email uniqueness if email updated
      if (updates.email && updates.email !== targetEntry.key) {
        if (inMemoryUsers.has(updates.email)) {
          return res.status(400).json({ message: 'Email is already in use by another account' });
        }
      }

      const updatedUser = { ...targetEntry.user, ...updates };

      // Re-map key if email changed
      if (updates.email && updates.email !== targetEntry.key) {
        inMemoryUsers.delete(targetEntry.key);
        inMemoryUsers.set(updates.email, updatedUser);
      } else {
        inMemoryUsers.set(targetEntry.key, updatedUser);
      }

      return res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      });
    }
  } catch (error) {
    console.error(`Update Profile Error: ${error.message}`);
    res.status(500).json({ message: 'Server error updating profile: ' + error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
};

