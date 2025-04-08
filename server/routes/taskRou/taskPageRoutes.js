const express = require('express');
const router = express.Router();
const taskPageController = require('../../controllers/taskCon/taskPageController');
const { isLoggedIn } = require('../../middleware/checkAuth');
const spaceController = require('../../controllers/spaceController');
const { uploadCovers } = require('../../middleware/upload');
const chatController = require('../../controllers/chatController');
const upload = require('../../middleware/upload-chat'); // ต้องสร้าง middleware นี้
const taskSettingController = require('../../controllers/taskCon/taskSettingController');


router.get('/space/item/:id/dashboard', isLoggedIn, taskPageController.task_dashboard);
router.get('/space/item/:id/task_list', isLoggedIn, taskPageController.task_list);
router.get('/space/item/:id/task_board', isLoggedIn, taskPageController.task_board);
router.get('/space/item/:id/granttChart', isLoggedIn, taskPageController.granttChart); 
router.get('/space/item/:id/chat', isLoggedIn, chatController.renderChatPage);
router.get('/space/item/:id/setting', isLoggedIn, taskSettingController.projecttasksetting);

router.post('/space/item/:id/chat', isLoggedIn, chatController.postMessage);
router.post('/space/item/:id/chat/:messageId/read', isLoggedIn, chatController.markAsRead);

router.get('/space/item/unread-messages', isLoggedIn, chatController.getUnreadMessageCount);
router.get('/space/item/unread-mentions', isLoggedIn, chatController.getUnreadMentionsCount);
router.get('/space/:spaceId/search-users', isLoggedIn, chatController.searchUsers);
router.post('/space/item/:spaceId/mark-all-as-read', isLoggedIn, chatController.markAllAsRead);

router.get('/space/item/:id/chat/private/:targetUserId', isLoggedIn, chatController.renderPrivateChatPage);
router.post('/space/item/:id/chat/private/:targetUserId/send', isLoggedIn, chatController.sendPrivateMessage);
router.post('/space/item/:id/chat/private/:messageId/read', isLoggedIn, chatController.markPrivateMessageAsRead);

router.get('/space/item/:id/chat/unread-count', isLoggedIn, chatController.getUnreadGroupMessageCount);
router.get('/space/item/:id/chat/private/:targetUserId/unread-count', isLoggedIn, chatController.getUnreadPrivateMessageCount);
router.post('/:id/chat/mark-group-read', chatController.markGroupMessagesAsRead);

router.post('/:id/chat/private/:targetUserId/mark-as-read', chatController.markPrivateMessagesAsRead);
router.post('/space/item/:id/chat/private/:targetUserId/mark-as-read', chatController.markPrivateMessagesAsRead);

router.post('/space/item/:id/chat/upload', isLoggedIn, upload.array('files', 5), chatController.uploadFiles);
router.post('/space/item/:id/chat/private/:targetUserId/upload', isLoggedIn, upload.array('files', 5), chatController.uploadPrivateFiles);
router.get('/space/:spaceId/mention/tasks', isLoggedIn, chatController.getMentionTasks);
router.get('/space/:spaceId/mention/tasks', isLoggedIn, chatController.getTasksForMention);

module.exports = router;