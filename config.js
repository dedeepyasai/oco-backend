// config.js
const config = {
    development: {
        apiUrl: 'http://localhost:3000',
        env: 'development'
    },
    production: {
        apiUrl: 'https://oco-ai-backend.onrender.com',
        env: 'production'
    }
};

// Read environment from .env.js file
const currentEnv = window.ENV_CONFIG?.environment || 'production';
console.log('Current environment:', currentEnv);

// Export the configuration
const currentConfig = config[currentEnv];