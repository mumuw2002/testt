const path = require('path');
const fs = require('fs');
const Spaces = require('../../models/Space');
const User = require('../../models/User');
const mongoose = require('mongoose');
const multer = require('multer');
const Task = require('../../models/Task');
const upload = multer({ dest: 'uploads/' });
const sharp = require('sharp');

exports.projecttasksetting = async (req, res) => {
    try {
        const spaceId = req.params.id;
        const space = await Spaces.findById(spaceId).lean();

        let projectCover = space.projectCover;
        if (!projectCover.includes('_optimized')) {
            projectCover = space.projectCover.replace('.webp', '_optimized.webp');
        }

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
            projectCover: projectCover
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
            
            const space = await Spaces.findById(spaceId);
            if (space.projectCover && space.projectCover !== '/public/spacePictures/defultBackground.webp') {
                const oldFilePath = path.join(__dirname, '../public', space.projectCover);
                try {
                    await fs.promises.unlink(oldFilePath);
                    const baseName = path.basename(oldFilePath, path.extname(oldFilePath));
                    const dirName = path.dirname(oldFilePath);
                    const sizes = ['_1200', '_600', '_300'];
                    for (const size of sizes) {
                        const sizePath = path.join(dirName, `${baseName}${size}.webp`);
                        await fs.promises.unlink(sizePath).catch(() => {});
                    }
                } catch (err) {
                    console.error('Error deleting old image:', err);
                }
            }
        }

        await Spaces.findByIdAndUpdate(spaceId, updateData);
        res.redirect(`/space/item/${spaceId}/setting`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating project");
    }
};

exports.deleteSpace = async (req, res) => {
    try {
        const spaceId = req.params.id;
        
        // ตรวจสอบว่าผู้ใช้เป็นเจ้าของ Space หรือไม่
        const space = await Spaces.findById(spaceId);
        if (!space) {
            return res.status(404).json({ error: 'ไม่พบโปรเจกต์นี้' });
        }

        const isOwner = space.collaborators.some(
            collab => collab.user.toString() === req.user._id.toString() && collab.role === 'owner'
        );

        if (!isOwner) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบโปรเจกต์นี้' });
        }

        // ลบ Space และ Task ที่เกี่ยวข้อง
        await Spaces.findByIdAndDelete(spaceId);
        await Task.deleteMany({ spaceId: spaceId });

        res.status(200).json({ message: 'ลบโปรเจกต์สำเร็จ' });
    } catch (err) {
        console.error('Error deleting space:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบโปรเจกต์' });
    }
};
