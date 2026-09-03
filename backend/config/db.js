const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[MongoDB] ❌ MONGODB_URI is not set in .env');
    return;
  }

  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    console.warn('[MongoDB] ⚠️  URI points to localhost — make sure mongod is running, or switch to Atlas.');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
      maxPoolSize:              10,
    });
    isConnected = true;
    console.log(`[MongoDB] ✅ Connected: ${conn.connection.host}`);
  } catch (error) {
    isConnected = false;
    console.error('[MongoDB] ❌ Connection failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('[MongoDB]    → mongod is not running. Update MONGODB_URI in .env to your Atlas URI.');
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('[MongoDB]    → Wrong username or password in the connection string.');
    } else if (error.message.includes('querySrv') || error.message.includes('ENOTFOUND')) {
      console.error('[MongoDB]    → DNS lookup failed. Check your Atlas cluster hostname.');
    } else if (error.message.includes('whitelist') || error.message.includes('not whitelisted')) {
      console.error('[MongoDB]    → Your IP is not whitelisted. In Atlas → Network Access → Add 0.0.0.0/0.');
    }

    console.warn('[MongoDB] ⚡ Running in in-memory fallback mode. Data will not persist after restart.');
    console.warn('[MongoDB]    To fix: replace MONGODB_URI in backend/.env with your MongoDB Atlas URI.');
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB] ⚠️  Disconnected.');
  });
  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('[MongoDB] ✅ Reconnected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Error:', err.message);
  });
};

const isDbConnected = () => isConnected && mongoose.connection.readyState === 1;

module.exports = { connectDB, isDbConnected };
