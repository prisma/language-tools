// Mini download script to fetch prisma-fmt binary during install. 
const os = require("os");
const https = require('https');
const fs = require('fs');
const path = require('path');

// Decides which platform to use.
function getPlatform() {
  const platform = os.platform();
  if(platform === "darwin") {
    return platform;
  } else if(platform === 'linux') {
    // TODO: MUSL support.
    return 'linux-glibc'
  } else {
    console.error("prisma-fmt: Unsupported OS platform: " + platform);
    process.exit(-1);
  }
}

// Gets the download URL for a platform
function getFmtDownloadUrl(platform) {
  return "https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/" + platform + "/prisma-fmt";
}

const url = getFmtDownloadUrl(getPlatform());
console.log("prisma-fmt: Downloading from " + url);
const file = fs.createWriteStream(path.join(__dirname, "out/prisma-fmt"));

// Fetch fetch fetch.
https.get(url, function(response) {

  // Did everything go well?
  if(response.statusCode !== 200) {
    console.log("prisma-fmt: Download failed.")
    console.log(response.statusMessage)
    process.exit(-1)
  }

  // If so, pipe into our file.
  response.pipe(file);
  file.on('finish', function() {
    console.log("prisma-fmt: Download succeeded.");
    file.close();
  });
});