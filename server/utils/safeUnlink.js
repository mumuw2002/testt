const fs = require('fs');
const util = require('util');
const unlink = util.promisify(fs.unlink);

module.exports = async function safeUnlink(filePath, retries = 5, delay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            await unlink(filePath);
            return;
        } catch (err) {
            if (err.code === 'EBUSY' && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
};