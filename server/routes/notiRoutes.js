const express = require('express');
const router = express.Router();
const notiController = require('../controllers/notiController');
const { isLoggedIn } = require('../middleware/checkAuth');

router.get('/notifications', isLoggedIn, notiController.getNotifications);
router.delete('/notifications/clear-non-invitation', isLoggedIn, notiController.clearNonInvitationNotifications);
router.delete('/notifications/:id', isLoggedIn, notiController.deleteNotification);
router.post('/notifications/resend/:id', isLoggedIn, notiController.resendInvitation);
router.delete('/notifications/cancel/:id', isLoggedIn, notiController.cancelInvitation);

router.put('/notification/accept/:id', isLoggedIn, notiController.acceptInvitation);
router.put('/notification/reject/:id', isLoggedIn, notiController.rejectInvitation);

module.exports = router;