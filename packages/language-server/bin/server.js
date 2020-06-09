#! /usr/bin/env node

function tryRequire(path) {
    try {
        return require(path)
    } catch (err) {
        console.error(err)
        return
    }
}

const server = tryRequire('../dist/src/server')

server.startServer()
