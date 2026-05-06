const fs = require('fs');
const https = require('https');

// Create a basic 1x1 green transparent PNG and save it as icons since sharp can be slow.
// Actually let's just make it a valid png in base64.
const getPngBase64 = (size) => {
  // 1x1 green png base64
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDAAD/wH7w+BvVQAAAABJRU5ErkJggg==";
}

const sizes = [16, 48, 128];
if (!fs.existsSync('public/icons')) {
  fs.mkdirSync('public/icons', { recursive: true });
}

for (const size of sizes) {
  fs.writeFileSync(`public/icons/icon${size}.png`, Buffer.from(getPngBase64(size), 'base64'));
  console.log(`Generated icon${size}.png`);
}
