"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
function exec(execPath, args, input) {
    const fmt = child_process_1.spawn(execPath, args);
    const chunks = [];
    fmt.stdout.on('data', (data) => {
        chunks.push(data.toString());
    });
    const errChunks = [];
    fmt.stderr.on('data', (data) => {
        errChunks.push(data.toString());
    });
    fmt.stdin.setDefaultEncoding('utf-8');
    fmt.stdin.write(input);
    fmt.stdin.end();
    return new Promise((resolve, reject) => {
        fmt.on('exit', (code) => {
            if (code === 0 && errChunks.length === 0) {
                resolve(chunks.join(''));
            }
            else {
                reject(errChunks.join(''));
            }
        });
    });
}
exports.default = exec;
//# sourceMappingURL=exec.js.map