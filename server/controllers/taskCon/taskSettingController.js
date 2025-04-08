const Spaces = require('../../models/Space');
const User = require('../../models/User');
const mongoose = require('mongoose');
const multer = require('multer');
const Task = require('../../models/Task');
const upload = multer({ dest: 'uploads/' });

exports.projecttasksetting = async (req, res) => {
    try {
        const spaceId = req.params.id;

        // ดึง space + populate user (เจ้าของโปรเจกต์)
        const space = await Spaces.findById(spaceId).lean(); // ใช้ lean ได้เลยเพราะจะ handle เอง

        // ดึง collaborator ที่เป็นเจ้าของ
        const ownerCollaborator = space.collaborators.find(c => c.role === 'owner');
        
        let ownerUser = null;
        if (ownerCollaborator) {
            ownerUser = await User.findById(ownerCollaborator.user).lean();
        }
        
        const projectownerName = ownerUser
            ? `${ownerUser.firstName || ''} ${ownerUser.lastName || ''}`.trim()
            : 'ไม่พบข้อมูลผู้ใช้';
        
        res.render('task/task-setting', {
            spaces: space,
            spaceId: spaceId,
            user: req.user,
            currentPage: 'setting',
            projectownerName: projectownerName,
            ownerProfileImage: ownerUser?.profileImage || '/img/profileImage/Profile.jpeg',
            layout: '../views/layouts/task',
        });        
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateProjectSetting = async (req, res) => {
    try {
        const spaceId = req.params.id;
        const { projectName } = req.body;

        const updateData = { projectName };

        if (req.file) {
            updateData.projectCover = '/spacePictures/' + req.file.filename;
        }

        await Spaces.findByIdAndUpdate(spaceId, updateData);

        res.redirect(`/space/item/${spaceId}/setting`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating project");
    }
};



