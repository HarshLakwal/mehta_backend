const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  ITEM_CODE: {
    type: String,
    required: [true, 'Item code is required'],
    trim: true
  },
  ITEM_MODEL: {
    type: String,
    required: [true, 'Item model is required'],
    trim: true
  },
  ITEM_INTL_MODEL: {
    type: String,
    trim: true
  },
  MOP_AMOUNT: {
    type: String,
    required: [true, 'MOP amount is required'],
    trim: true
  },
  NLC_AMOUNT: {
    type: String,
    trim: true
  },
  INCENTIVE_AMOUNT: {
    type: String,
    default: '0.00',
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  }
});

const productSchema = new mongoose.Schema({
  MODEL_NAME: {
    type: String,
    required: [true, 'Model name is required'],
    trim: true
  },
  BRAND_CODE_LIST: {
    type: String,
    required: [true, 'Brand code list is required'],
    trim: true
  },
  data: {
    type: [itemSchema],
    required: [true, 'Data array is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Products', productSchema);
