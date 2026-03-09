const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Multer upload middleware
exports.uploadProductImage = upload.single('image');

// @desc    Upload image for a specific product item
// @route   POST /api/v1/products/:productId/items/:itemId/image
// @access  Private (Admin only)
exports.uploadItemImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an image file'
      });
    }

    const { productId, itemId } = req.params;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find the specific item in the data array
    const itemIndex = product.data.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in product'
      });
    }

    // Construct image URL (assuming server serves static files from uploads folder)
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Update the item with the image URL
    product.data[itemIndex].imageUrl = imageUrl;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        productId: product._id,
        itemId: product.data[itemIndex]._id,
        imageUrl: imageUrl
      }
    });

  } catch (err) {
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Get all products or search by MODEL_NAME and BRAND_CODE_LIST
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const { MODEL_NAME, BRAND_CODE_LIST } = req.query;
    
    let query = {};
    
    // Add search filters if provided
    if (MODEL_NAME) {
      query.MODEL_NAME = { $regex: MODEL_NAME, $options: 'i' }; // Case-insensitive search
    }
    
    if (BRAND_CODE_LIST) {
      query.BRAND_CODE_LIST = { $regex: BRAND_CODE_LIST, $options: 'i' }; // Case-insensitive search
    }
    
    const products = await Product.find(query);
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Helper function to trim whitespace from object keys
function sanitizeObjectKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectKeys(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const trimmedKey = key.trim();
    sanitized[trimmedKey] = sanitizeObjectKeys(value);
  }
  return sanitized;
}

// @desc    Create or update product with data array (upsert with deduplication)
// @route   POST /api/v1/products/bulk
// @access  Private
exports.createProducts = async (req, res, next) => {
  try {
    // Sanitize request body to remove whitespace from keys
    const sanitizedBody = sanitizeObjectKeys(req.body);
    
    // Expecting a single product object with Data array
    if (Array.isArray(sanitizedBody)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Request body must be a single product object, not an array' 
      });
    }

    const { MODEL_NAME, BRAND_CODE_LIST } = sanitizedBody;
    const newDataArray = sanitizedBody.Data || sanitizedBody.data || [];

    // Find existing product by MODEL_NAME and BRAND_CODE_LIST
    let existingProduct = await Product.findOne({
      MODEL_NAME: MODEL_NAME,
      BRAND_CODE_LIST: BRAND_CODE_LIST
    });

    if (existingProduct) {
      // Get existing ITEM_CODEs for deduplication
      const existingItemCodes = new Set(existingProduct.data.map(item => item.ITEM_CODE));

      // Filter out duplicate items based on ITEM_CODE
      const uniqueNewItems = newDataArray.filter(item => !existingItemCodes.has(item.ITEM_CODE));

      if (uniqueNewItems.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No new items to add - all ITEM_CODEs already exist',
          data: existingProduct
        });
      }

      // Add only unique new items to existing data array
      existingProduct.data.push(...uniqueNewItems);
      await existingProduct.save();

      res.status(200).json({
        success: true,
        message: `Added ${uniqueNewItems.length} new items`,
        addedItems: uniqueNewItems,
        data: existingProduct
      });
    } else {
      // Create new product if MODEL_NAME + BRAND_CODE_LIST combination doesn't exist
      const productData = {
        MODEL_NAME: MODEL_NAME,
        BRAND_CODE_LIST: BRAND_CODE_LIST,
        data: newDataArray
      };

      const product = await Product.create(productData);
      res.status(201).json({
        success: true,
        message: `Created new product with ${newDataArray.length} items`,
        data: product
      });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Get specific item from product data array by ITEM_CODE
// @route   GET /api/v1/products/:productId/items/:itemCode
// @access  Public
exports.getProductItem = async (req, res, next) => {
  try {
    const { productId, itemCode } = req.params;
    
    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    // Find the specific item by ITEM_CODE
    const item = product.data.find(dataItem => dataItem.ITEM_CODE === itemCode);
    
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        error: `Item with ITEM_CODE '${itemCode}' not found in product` 
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        productInfo: {
          _id: product._id,
          MODEL_NAME: product.MODEL_NAME,
          BRAND_CODE_LIST: product.BRAND_CODE_LIST
        },
        item: item
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
