const line = require('@line/bot-sdk');

const config = {
    channelAccessToken: 'zHaRFT37Oh8ar2Sqq4CJLQQRBhiex+bYArm2eBj6Qoh13bD4XHLUrq6UB8HeTCCWfSao//KEEOJmmxhFSY3roF5pmTezY7CaIWTl+lSZLK4xoScGiVY0Nb1dmuBk/u5eSVSAHV68d2e/Oqj3IATdNQdB04t89/1O/w1cDnyilFU=',
    channelSecret: 'dcc4b69c25b63d37d3dfa50e100d3fd9'
};

const client = new line.Client(config);

module.exports = client;