const express = require('express');
const router = express.Router();
const docCtrl = require('../controllers/document.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

router.use(protect); // all document routes require auth

router.post('/upload', upload.single('file'), docCtrl.upload);
router.get('/', docCtrl.getAll);
router.get('/:id', docCtrl.getOne);
router.get('/:id/status', docCtrl.getStatus);
router.delete('/:id', docCtrl.remove);

module.exports = router;
