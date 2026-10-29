import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate and normalize a MongoDB connection string without exposing it.
 * Returns the trimmed URI, or null when it is not set.
 * Throws an Error with a concise, non-secret diagnostic message when invalid.
 */
export function validateMongoUri(raw) {
  if (raw == null) return null;

  const uri = String(raw).trim();
  if (uri === '') {
    throw new Error('MONGODB_URI is set but empty. Set it to a valid mongodb:// or mongodb+srv:// connection string.');
  }

  // Common copy/paste mistakes: the variable name or surrounding quotes were included.
  if (/^MONGODB_URI\s*=/i.test(uri)) {
    throw new Error('MONGODB_URI must contain only the connection string, not "MONGODB_URI=...".');
  }
  if (/^['"].*['"]$/.test(uri)) {
    throw new Error('MONGODB_URI must not include surrounding quotes. Remove the quote characters.');
  }

  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    throw new Error('MONGODB_URI must start with "mongodb://" or "mongodb+srv://".');
  }

  // Placeholders or unencoded template values are not valid credentials/hosts.
  if (/[<>]/.test(uri)) {
    throw new Error('MONGODB_URI contains placeholder characters (< or >). Replace placeholders with real values.');
  }
  if (/:\/\/[^/]*username:password/i.test(uri)) {
    throw new Error('MONGODB_URI contains placeholder credentials. Use real Atlas credentials.');
  }

  return uri;
}

function classifyMongoError(err) {
  const name = err && err.constructor ? err.constructor.name : 'Error';
  const message = err && typeof err.message === 'string' ? err.message.toLowerCase() : '';

  if (name === 'MongoParseError' || /invalid scheme|connection string/i.test(message)) {
    return 'malformed URI';
  }
  if (/authentication failed|bad auth|auth/i.test(message)) {
    return 'authentication failure';
  }
  if (/enotfound|getaddrinfo|dns/i.test(message)) {
    return 'DNS resolution failure';
  }
  if (/ip.*not.*allowed|not.*whitelisted|network access/i.test(message)) {
    return 'network access / IP allowlist failure';
  }
  if (/tls|ssl|certificate/i.test(message)) {
    return 'TLS/certificate failure';
  }
  if (/server selection|timed out/i.test(message)) {
    return 'server selection / connectivity timeout';
  }
  return 'connection failure';
}

export async function connectDB() {
  // If already connected, return early to avoid duplicate connections
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const uri = validateMongoUri(process.env.MONGODB_URI);

  if (!uri && process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI must be set in production. Set it in Render Dashboard -> hand-holding-server -> Environment, then redeploy.');
  }

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2500,
        socketTimeoutMS: 45000,
      });
      console.log('[db] Connected to MongoDB (database: ' + mongoose.connection.name + ')');
      return;
    } catch (err) {
      const category = classifyMongoError(err);
      const error = new Error(`MongoDB connection failed: ${category}`);
      error.cause = err;
      error.category = category;
      error.errorType = err && err.constructor ? err.constructor.name : 'Error';
      console.error('[db] MongoDB connection failed');
      console.error('[db] Error type:', error.errorType);
      console.error('[db] Category:', category);
      if (category === 'malformed URI') {
        console.error('[db] MONGODB_URI must be a mongodb:// or mongodb+srv:// string only: no quotes, no "MONGODB_URI=" prefix, no placeholders.');
      }
      throw error;
    }
  }

  // Fallback to local MongoDB only if MONGODB_URI is not explicitly set
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/hand_holding', {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('[db] Connected to local MongoDB (database: ' + mongoose.connection.name + ')');
    return;
  } catch (err) {
    const error = new Error('Local MongoDB not available and no MONGODB_URI set');
    error.cause = err;
    console.error('[db] Local MongoDB not available and no MONGODB_URI set');
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
  } catch (err) {
    console.error('[db] Error during disconnect:', err && err.constructor ? err.constructor.name : 'Error');
    // Do not throw - disconnect should be safe to call
  }
}