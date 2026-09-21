const express = require('express');
const router = express.Router();
const { validateTunnelAccess, recordUsage } = require('../controllers/internalTunnelController');
const { verifyInternalProxy } = require('../middlewares/auth');

// Todo el enrutador interno está protegido por la firma interna del Proxy
router.use(verifyInternalProxy);

router.post('/validate', validateTunnelAccess);
router.post('/usage', recordUsage);

module.exports = router;
