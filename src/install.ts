// Mini download script to fetch prisma-fmt binary during install. 
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';
import * as zlib from 'zlib';

// Decides which platform to use.
function getPlatform() {
  const platform = os.platform();
  if(platform === "darwin") {
    return platform;
  } else if(platform === 'linux') {
    return 'debian'; // TODO: Add support for 'rhel'
  } else if(platform === 'win32') {
    return 'windows'
  } else {
    throw "prisma-fmt: Unsupported OS platform: " + platform;
  }
}

// Gets the download URL for a platform
function getFmtDownloadUrl(platform, basename: string) {
  return "https://prisma-builds.s3-eu-west-1.amazonaws.com/master/latest/" + platform + "/" + basename + ".gz";
}

export default function install(fmtPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = getFmtDownloadUrl(getPlatform(), path.basename(fmtPath));
    console.log("prisma-fmt: Downloading from " + url);
    const file = fs.createWriteStream(fmtPath);

    // Fetch fetch fetch.
    https.get(url, function(response) {
      // Did everything go well?
      if(response.statusCode !== 200) {
        reject(response.statusMessage)
      }

      // If so, unzip and pipe into our file.
      const unzip = zlib.createGunzip()
      response.pipe(unzip).pipe(file)
      file.on('finish', function() {
        fs.chmodSync(fmtPath, '755')
        file.close()
        resolve(fmtPath)
      });
    });
  })
}