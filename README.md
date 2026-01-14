# Streamline Shopify App - Backend

Backend server for the Streamline Shopify App built with the MERN stack.

## Features

- Express.js server
- MongoDB database with Mongoose ODM
- CORS enabled
- Security headers with Helmet
- Request logging with Morgan
- Modular architecture with separate folders for routes, controllers, models, etc.
- Environment-based configuration

## Project Structure

```
server/
├── config/
│   └── database.js          # Database connection setup
├── controllers/             # Route controllers (business logic)
├── middleware/              # Custom middleware functions
├── models/                  # Mongoose models
├── routes/
│   └── index.js             # Main routes file
├── utils/                   # Utility functions
├── .env                     # Environment variables
├── package.json             # Dependencies and scripts
├── server.js                # Main server file
└── README.md                # This file
```

## Getting Started

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env` and update the values as needed
   - Ensure MongoDB is running locally or update MONGODB_URI

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The server will start on `http://localhost:5000`

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api` - API information

## Development

- Use `npm run dev` for development with auto-restart
- Use `npm start` for production

## Contributing

Follow the modular structure and add appropriate comments to new code.