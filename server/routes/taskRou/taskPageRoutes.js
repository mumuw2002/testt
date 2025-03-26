const express = require('express');
const router = express.Router();
const taskPageController = require('../../controllers/taskCon/taskPageController');
const { isLoggedIn } = require('../../middleware/checkAuth');
const spaceController = require('../../controllers/spaceController');
const { uploadCovers } = require('../../middleware/upload');
const chatController = require('../../controllers/chatController');

router.get('/space/item/:id/dashboard', isLoggedIn, taskPageController.task_dashboard);
router.get('/space/item/:id/task_list', isLoggedIn, taskPageController.task_list);
router.get('/space/item/:id/task_board', isLoggedIn, taskPageController.task_board);
router.get('/space/item/:id/granttChart', isLoggedIn, taskPageController.granttChart); 
router.get('/space/item/:id/chat', isLoggedIn, chatController.renderChatPage);
router.post('/space/item/:id/chat', isLoggedIn, chatController.postMessage);
router.post('/space/item/:id/chat/:messageId/read', isLoggedIn, chatController.markAsRead);

router.get('/space/item/unread-messages', isLoggedIn, chatController.getUnreadMessageCount);
router.get('/space/item/unread-mentions', isLoggedIn, chatController.getUnreadMentionsCount);
router.get('/space/:spaceId/search-users', isLoggedIn, chatController.searchUsers);
router.post('/space/item/:spaceId/mark-all-as-read', isLoggedIn, chatController.markAllAsRead);

router.get('/space/item/:id/chat/private/:targetUserId', isLoggedIn, chatController.renderPrivateChatPage);
router.post('/space/item/:id/chat/private/:targetUserId/send', isLoggedIn, chatController.sendPrivateMessage);
router.post('/space/item/:id/chat/private/:messageId/read', isLoggedIn, chatController.markPrivateMessageAsRead);

module.exports = router;