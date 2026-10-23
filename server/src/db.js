import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let memoryServer = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri && process.env.NODE_ENV === 'production') {
    console.error('[db] MONGODB_URI must be set in production');
    process.exit(1);
  }
  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2500,
        socketTimeoutMS: 45000,
      });
      console.log('[db] Connected to MongoDB Atlas');
      return;
    } catch (err) {
      console.error('[db] MongoDB Atlas connection failed');
      console.error('[db] Error name:', err.constructor.name);
      console.error('[db] Error message:', err.message.substring(0, 200));
      // Do NOT fall back to in-memory server in normal development
      // Exit so the API does not accept requests without a database
      process.exit(1);
    }
  }

  // Fallback to local MongoDB only if MONGODB_URI is not explicitly set
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/hand_holding', {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('[db] Connected to local MongoDB (hand_holding)');
    return;
  } catch {
    console.error('[db] Local MongoDB not available and no MONGODB_URI set');
    // Do NOT silently fall back to MongoDB Memory Server
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
