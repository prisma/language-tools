#! /usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-var-requires
console.log(__dirname)
const { startServer } = require('../src/server');

startServer();