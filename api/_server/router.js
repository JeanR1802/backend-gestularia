const serverless = require('serverless-http');
const app = require('../../server'); // tu server.js
module.exports.handler = serverless(app);
