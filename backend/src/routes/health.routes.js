const { Router } = require('express');

const { getHealth, getReadiness } = require('../controllers/health.controller');

const router = Router();

router.get('/', getHealth);
router.get('/ready', getReadiness);

module.exports = router;
