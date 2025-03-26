//Collaboration Controller
const Spaces = require('../models/Space');
const User = require("../models/User");
const Notification = require('../models/Noti');
const moment = require('moment');
const logUserActivity = require('../utils/activityLogger');
const logFeatureUsage = require('../utils/featureLogger');

exports.manage_Member = async (req, res) => {
    try {
        const space = await Spaces.findOne({
            _id: req.params.id,
            $or: [
                { user: req.user._id },
                { collaborators: { $elemMatch: { user: req.user._id } } }
            ]
        })
            .populate('user', 'username profileImage isOnline')
            .populate('collaborators.user', 'username profileImage email googleEmail lastActive isOnline')
            .lean();

        if (!space) {
            return res.status(404).send("Space not found");
        }

        // Safely filter collaborators to include only valid ones with a populated user
        const validCollaborators = (space.collaborators || []).filter(collab => collab && collab.user);

        const currentUserRole = validCollaborators.find(
            collab => collab.user._id.toString() === req.user._id.toString()
        )?.role || 'member';

        // Collect all collaborator IDs
        const collaboratorIds = validCollaborators.map(collab => collab.user._id.toString());
        if (space.user && space.user._id) {
            collaboratorIds.push(space.user._id.toString());
        }

        // Find all users not already in the space as collaborators
        const allUsers = await User.find(
            { _id: { $nin: collaboratorIds } },
            'username profileImage googleEmail isOnline'
        ).lean();

        // Fetch pending invitations
        const pendingInvitations = await Notification.find({ space: req.params.id, status: 'pending' })
            .populate('user', 'username profileImage googleEmail isOnline')
            .lean();

        res.render("task/task-member", {
            spaces: space,
            spaceId: req.params.id,
            collaborators: validCollaborators,
            owner: space.user,
            allUsers,
            user: req.user,
            userImage: req.user.profileImage,
            userName: req.user.username,
            currentPage: 'task_member',
            currentUserRole,
            pendingInvitations,
            layout: "../views/layouts/task",
            moment
        });

    } catch (error) {
        console.error('Error loading task member page:', error);
        res.status(500).send("Internal Server Error");
    }
};

exports.addMemberToSpace = async (req, res) => {
    try {
        const { memberId, role, spaceId } = req.body;

        // Validate required fields
        if (!memberId || !role || !spaceId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Find the space
        const space = await Spaces.findById(spaceId);
        if (!space) {
            return res.status(404).json({ success: false, message: 'Space not found' });
        }

        // Check if the current user has sufficient permissions
        const currentUserRole = space.collaborators.find(collab => collab.user.toString() === req.user._id.toString())?.role;
        if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only the admin or owner can add members' });
        }

        // Check if the user is already a member
        const isMember = space.collaborators.some(collab => collab.user.toString() === memberId);
        if (isMember) {
            return res.status(400).json({ success: false, message: 'User is already a member of this space' });
        }

        // Add the user directly to the collaborators
        space.collaborators.push({ user: memberId, role });
        await space.save();

        await logUserActivity(req.user._id, 'เชิญสมาชิกเข้าร่วมโปรเจกต์');
        await logFeatureUsage('เชิญสมาชิกเข้าร่วมโปรเจกต์');

        res.status(200).json({ success: true, message: 'Member added successfully!' });
    } catch (error) {
        console.error('Error adding member to space:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


exports.searchMembers = async (req, res) => {
    try {
        const query = req.query.q;
        const spaceId = req.query.spaceId;

        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }

        // Find the space to get the list of current members and pending invitations
        const space = await Spaces.findById(spaceId).lean();
        if (!space) {
            return res.status(404).json({ message: 'Space not found' });
        }

        const collaboratorIds = space.collaborators.map(collab => collab.user.toString());
        const pendingInvitations = await Notification.find({ space: spaceId, status: 'pending' }).lean();
        const pendingInvitationIds = pendingInvitations.map(invite => invite.user.toString());

        const excludedIds = [...collaboratorIds, ...pendingInvitationIds];

        const users = await User.find(
            {
                _id: { $nin: excludedIds },
                $or: [
                    { username: { $regex: query, $options: 'i' } },
                    { userid: { $regex: query, $options: 'i' } },
                    { googleEmail: { $regex: query, $options: 'i' } },
                ],
            },
            'username userid googleEmail profileImage'
        ).lean();

        await logUserActivity(req.user._id, 'ค้นหาสมาชิก');
        await logFeatureUsage('ค้นหาสมาชิก');

        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.updateRole = async (req, res) => {
    const { memberId } = req.params;
    const { role, spaceId } = req.body; 

    try {
        const space = await Spaces.findOne({
            _id: spaceId,
            collaborators: { $elemMatch: { user: req.user._id, role: { $in: ['owner', 'admin'] } } }
        });

        if (!space) {
            return res.status(403).json({ success: false, message: 'Unauthorized to change role.' });
        }

        const member = space.collaborators.find(collab => collab.user.toString() === memberId);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found.' });
        }

        await Spaces.updateOne(
            { _id: spaceId, 'collaborators.user': memberId },
            { $set: { 'collaborators.$.role': role } }
        );

        // Create a notification for the user whose role has been changed
        const notification = new Notification({
            user: memberId,
            space: spaceId,
            role,
            status: 'accepted', // Directly set to accepted since it's a role change notification
            type: 'roleChange',
            leader: req.user._id,
            message: `บทบาทของคุณได้ถูกเปลี่ยนเป็น ${role}`
        });
        await notification.save();

        await logUserActivity(req.user._id, 'เชิญสมาชิกเข้าร่วมโปรเจกต์');
        await logFeatureUsage('เชิญสมาชิกเข้าร่วมโปรเจกต์');

        res.json({ success: true, message: 'Role updated successfully and notification sent.' });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.deleteMember = async (req, res) => {
    const { memberId } = req.params;
    const { spaceId } = req.body;

    try {
        const space = await Spaces.findOne({
            _id: spaceId,
            collaborators: { $elemMatch: { user: req.user._id, role: 'Leader' } }
        });

        if (!space) {
            return res.status(403).json({ success: false, message: 'Unauthorized to remove member.' });
        }

        const memberIndex = space.collaborators.findIndex(collab => collab.user.toString() === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ success: false, message: 'Member not found.' });
        }

        const removedMember = space.collaborators.splice(memberIndex, 1)[0];
        await space.save();

        // Create a notification for the user who has been removed
        const notification = new Notification({
            user: memberId,
            space: spaceId,
            role: removedMember.role,
            status: 'accepted', // Directly set to accepted since it's a removal notification
            type: 'removal',
            leader: req.user._id // Include the leader's information
        });
        await notification.save();

        await logUserActivity(req.user._id, 'ลบสมาชิกในโปรเจกต์');
        await logFeatureUsage('ลบสมาชิกในโปรเจกต์');

        res.json({ success: true, message: 'Member removed successfully and notification sent.' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.respondToInvitation = async (req, res) => {
    try {
        const { notificationId, response } = req.body;

        // Find the notification and populate the space
        const notification = await Notification.findById(notificationId).populate('space');
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

        console.log('Notification found:', notification); // Log to check if notification is retrieved properly

        // Proceed only if the response is "accepted"
        if (response === 'accepted') {
            const space = notification.space;
            console.log('Space found:', space);  // Log the space to check

            // Check if the user is already in the collaborators array
            const isUserAlreadyCollaborator = space.collaborators.some(collaborator => 
                collaborator.user.toString() === notification.user.toString()
            );
            if (!isUserAlreadyCollaborator) {
                console.log('Adding user to collaborators');  // Log when adding the user

                // Add the user to the collaborators array with the correct role and join date
                space.collaborators.push({
                    user: notification.user,
                    role: notification.role,
                    joinDate: new Date()
                });

                // Save the updated space document
                await space.save();
                console.log('Space updated:', space);  // Log the updated space
            } else {
                console.log('User already a collaborator');
            }

            // Update the notification to reflect the accepted status
            notification.status = 'accepted';
            await notification.save();
            console.log('Notification updated:', notification); // Log to check if the notification was updated correctly

            // Notify other members about the new collaborator
            const otherMembers = space.collaborators.filter(collab => collab.user.toString() !== notification.user.toString());
            for (const member of otherMembers) {
                const newNotification = new Notification({
                    user: member.user,
                    space: space._id,
                    role: notification.role,
                    status: 'accepted',
                    type: 'memberAdded',
                    leader: notification.user
                });
                await newNotification.save();
            }
        }

        // Delete the invitation notification after responding
        await Notification.findByIdAndDelete(notificationId);

        res.status(200).json({ success: true, message: 'Response recorded successfully' });
    } catch (error) {
        console.error('Error responding to invitation:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
