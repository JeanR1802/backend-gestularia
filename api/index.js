// api/index.js
const serverless = require('serverless-http');
const app = require('../server'); // apunta a tu server.js

module.exports.handler = serverless(app);
