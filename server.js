const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection details - These should be in .env file
const mongoUrl = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

// For deployment, this should be your GitHub Pages URL in production
const clientURL = process.env.NODE_ENV === 'production' 
  ? 'https://[your-github-username].github.io'
  : 'http://localhost:3000';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Enhanced CORS configuration
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

// MongoDB Connection Pool
let client;
async function connectDB() {
  try {
    if (!client) {
      client = await MongoClient.connect(mongoUrl);
      console.log('Connected to MongoDB');
    }
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// API Routes
app.get('/config', (req, res) => {
  res.json({ 
    apiUrl: process.env.NODE_ENV === 'production' 
      ? 'https://your-backend-url.com/api'
      : 'http://localhost:3000/api' 
  });
});

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// API endpoint to add email to the database
app.post('/api/waitlist', async (req, res) => {
  const { email } = req.body;

  // Input validation
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const dbClient = await connectDB();
    const collection = dbClient.db(dbName).collection(collectionName);

    // Check for duplicate email
    const existingEmail = await collection.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists in the waitlist.' });
    }

    // Add timestamp to the record
    const result = await collection.insertOne({ 
      email,
      createdAt: new Date(),
      source: req.headers.origin || 'unknown'
    });

    res.status(200).json({ 
      message: 'Email added to the waiting list successfully.',
      id: result.insertedId
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to add email to the waiting list.' });
  }
});

// API endpoint to fetch all emails from the database
app.get('/api/waitlist', async (req, res) => {
  try {
    const dbClient = await connectDB();
    const collection = dbClient.db(dbName).collection(collectionName);

    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      collection.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments({})
    ]);

    res.status(200).json({
      data: emails,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch emails from the waiting list.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server and database connection...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});