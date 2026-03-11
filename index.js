const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Route files
const brands = require('./routes/brandRoutes');
const products = require('./routes/productRoutes');
const auth = require('./routes/authRoutes');

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// CORS Configuration
app.use(cors({
  origin: ['http://192.168.5.10:1235', 'http://mehtastore.collabsoftech.com', 'https://mehtastore.collabsoftech.com'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Mount routers
app.use('/api/v1/brands', brands);
app.use('/api/v1/products', products);
app.use('/api/v1/auth', auth);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
  });

// Basic Route
app.get('/', (req, res) => {
  res.send('Welcome to Mehta Store Backend!');
});
