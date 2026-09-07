const express = require('express');
const router = express.Router();
const chatCtrl = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/sessions', chatCtrl.createSession);
router.get('/sessions', chatCtrl.getSessions);
router.get('/sessions/:id', chatCtrl.getSession);
router.post('/sessions/:id/ask', chatCtrl.ask);
router.delete('/sessions/:id', chatCtrl.deleteSession);

module.exports = router;
