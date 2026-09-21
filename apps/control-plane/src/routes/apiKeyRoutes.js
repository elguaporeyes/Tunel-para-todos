const express = require('express');
const router = express.Router();
const { listApiKeys, createApiKey, revokeApiKey } = require('../controllers/apiKeyController');
const { protectUser } = require('../middlewares/auth');

router.use(protectUser);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:keyId', revokeApiKey);

module.exports = router;
