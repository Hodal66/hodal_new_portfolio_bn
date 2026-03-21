const http = require('http');

const postData = JSON.stringify({
  name: "QA Auditor",
  email: "qa@hodaltech.com",
  message: "Test message for audit."
});

const options = {
  hostname: 'localhost',
  port: 3300,
  path: '/v1/messages/contact',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(postData);
req.end();
