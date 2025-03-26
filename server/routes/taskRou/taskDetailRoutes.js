const express = require('express');
const router = express.Router();
const taskDetailController = require('../../controllers/taskCon/taskDetailController');
const { isLoggedIn } = require('../../middleware/checkAuth');
const { uploadFiles, uploadCovers }  = require('../../middleware/upload'); 

router.get('/task/:id/detail', isLoggedIn, taskDetailController.ItemDetail);

router.post('/updateTask', isLoggedIn, taskDetailController.updateTask);
router.post('/updateTaskStatus', isLoggedIn, taskDetailController.updateTaskStatus);
router.post('/updateTaskPriority',isLoggedIn, taskDetailController.updateTaskPriority);
router.post('/updateDueDate', isLoggedIn, taskDetailController.updateDueDate);
router.post('/updateDueTime', isLoggedIn, taskDetailController.updateDueTime);

router.post('/deleteActivityLog', isLoggedIn, taskDetailController.deleteActivityLog);
router.post('/uploadDocument/:id', uploadFiles.array('documents', 5),isLoggedIn, taskDetailController.uploadDocument);

module.exports = router;