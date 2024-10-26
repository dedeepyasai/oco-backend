const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// MongoDB connection details
const mongoUrl = "mongodb+srv://dattasai2511:JOytKbJ6V9PXyn08@waitlist-emails.mhip8.mongodb.net/?retryWrites=true&w=majority&appName=waitlist-emails";
const dbName = 'OCO_DB';
const collectionName = 'wailistEmails';

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 200
}));

// MongoDB Connection Pool
let client;
async function connectDB() {
    try {
        if (!client) {
            client = await MongoClient.connect(mongoUrl, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverApi: {
                    version: '1',
                    strict: true,
                    deprecationErrors: true
                },
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000
            });
            console.log('Connected to MongoDB');
        }
        return client;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await connectDB();
        res.status(200).json({ 
            status: 'healthy',
            server: 'running',
            database: 'connected',
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            error: 'Database connection failed'
        });
    }
});

// Add email to waitlist
app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    try {
        const dbClient = await connectDB();
        const collection = dbClient.db(dbName).collection(collectionName);

        // Check for duplicate email
        const existingEmail = await collection.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({ 
                message: 'Email already exists in the waitlist.'
            });
        }

        // Add new email
        const result = await collection.insertOne({ 
            email,
            createdAt: new Date(),
            source: req.headers.origin || 'direct'
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

// Fetch all emails
app.get('/api/waitlist', async (req, res) => {
    try {
        const dbClient = await connectDB();
        const collection = dbClient.db(dbName).collection(collectionName);

        const emails = await collection.find({})
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({
            data: emails,
            pagination: {
                total: emails.length,
                page: 1,
                pages: 1
            }
        });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to fetch emails from the waiting list.' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server with connection retry
const startServer = async () => {
    let retries = 5;
    
    while (retries) {
        try {
            await connectDB();
            
            app.listen(port, () => {
                console.log(`Server is running on port ${port}`);
                console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            });
            
            break;
        } catch (error) {
            console.error(`Failed to start server, retries left: ${retries}`);
            retries -= 1;
            if (!retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (client) {
        client.close().then(() => process.exit(1));
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    if (client) {
        client.close().then(() => process.exit(1));
    } else {
        process.exit(1);
    }
});

// Start the server
startServer().catch((error) => {
    console.error('Failed to start the server:', error);
    process.exit(1);
});