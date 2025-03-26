const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const lineClient = require('../config/lineClient');

const config = {
    channelAccessToken: 'zHaRFT37Oh8ar2Sqq4CJLQQRBhiex+bYArm2eBj6Qoh13bD4XHLUrq6UB8HeTCCWfSao//KEEOJmmxhFSY3roF5pmTezY7CaIWTl+lSZLK4xoScGiVY0Nb1dmuBk/u5eSVSAHV68d2e/Oqj3IATdNQdB04t89/1O/w1cDnyilFU=',
    channelSecret: 'dcc4b69c25b63d37d3dfa50e100d3fd9'
};

const middleware = line.middleware(config);

router.post('/webhook', middleware, (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error('Error handling event:', err);
            res.status(200).end(); // Ensure the response status is 200
        });
});

async function handleEvent(event) {
    try {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return Promise.resolve(null);
        }

        const echo = { type: 'text', text: event.message.text };
        await lineClient.replyMessage(event.replyToken, echo);
        return Promise.resolve();
    } catch (error) {
        console.error('Error in handleEvent:', error);
        return Promise.reject(error);
    }
}

module.exports = router;