// Simple script to debug server startup
import { exec } from 'child_process';

console.log("Starting server with debug output...");

const server = exec('NODE_DEBUG=module,http,net,stream tsx server/index.ts');

server.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

server.stderr.on('data', (data) => {
  console.log(`STDERR: ${data}`);
});

server.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Force exit after 20 seconds to match workflow timeout
setTimeout(() => {
  console.log("Timeout reached, closing debug process");
  server.kill();
  process.exit(1);
}, 20000);