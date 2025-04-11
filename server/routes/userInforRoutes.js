const express = require('express');
const router = express.Router();
const userInforController = require('../controllers/userInforController');
const { isLoggedIn } = require('../middleware/checkAuth');

router.get('/user/info/:userId', isLoggedIn, userInforController.getUserInfo);

module.exports = router;