const express = require('express');
const router = express.Router();
const taskSettingController = require('../../controllers/taskCon/taskSettingController');
const { uploadCover } = require('../../middleware/upload-projectsetting'); // ต้องสร้าง middleware นี้
const { isLoggedIn } = require('../../middleware/checkAuth');

router.post('/space/item/:id/setting', isLoggedIn, uploadCover.single('projectCover'), taskSettingController.updateProjectSetting);
router.delete('/space/item/:id/delete', isLoggedIn, taskSettingController.deleteSpace);

module.exports = router;
