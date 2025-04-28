// Simple wrapper to start our server
import { spawn } from 'child_process';
import http from 'http';

console.log("Starting server...");

// Start the server process
const server = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error(`Error starting server: ${error.message}`);
  process.exit(1);
});

// Check if the server is running by polling the port
function checkServerRunning() {
  const startTime = Date.now();
  const checkInterval = setInterval(() => {
    const req = http.get('http://localhost:5000/api/case-sensitivity-info', (res) => {
      console.log(`Server is running! Responded with status: ${res.statusCode}`);
      clearInterval(checkInterval);
      // Keep the process running to maintain the server
    }).on('error', (err) => {
      // Server not yet responding, check if we've timed out
      const elapsed = Date.now() - startTime;
      if (elapsed > 40000) { // 40 second timeout
        console.error('Server startup timed out after 40 seconds');
        clearInterval(checkInterval);
        server.kill();
        process.exit(1);
      }
    });
    
    req.on('error', () => {}); // Suppress additional errors
  }, 1000); // Check every second
}

// Start checking if the server is running
checkServerRunning();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill();
  process.exit(0);
});