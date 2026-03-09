const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  createProducts,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  uploadItemImage,
  getProductItem
} = require('../controllers/productController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(getProducts)
  .post(createProduct);

router
  .route('/bulk')
  .post(createProducts);

router
  .route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(deleteProduct);

// Get specific item from product data array
router
  .route('/:productId/items/:itemCode')
  .get(getProductItem);

// Image upload route - Admin only
router
  .route('/:productId/items/:itemId/image')
  .post(protect, authorize('admin'), uploadProductImage, uploadItemImage);

module.exports = router;
