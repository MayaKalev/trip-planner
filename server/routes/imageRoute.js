// routes/image.js
const express = require('express');
const router = express.Router();
const { getImageByLocation } = require('../controllers/imageController');


 
router.get('/', getImageByLocation);

module.exports = router;