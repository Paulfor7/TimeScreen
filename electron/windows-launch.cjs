const fs = require('node:fs');
const path = require('node:path');
const APP_ID = 'com.timescreen.desktop';

// A pinned window must reopen the persistent launcher, never the portable temp EXE.
function launchDetails({executable = process.execPath, portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE, packaged = true} = {}) {
  const launcher = packaged && portableExecutable && path.isAbsolute(portableExecutable) && fs.existsSync(portableExecutable)
    ? portableExecutable : executable;
  return {
    appId: APP_ID,
    appIconPath: launcher,
    appIconIndex: 0,
    relaunchCommand: `"${launcher}"`,
    relaunchDisplayName: 'TimeScreen'
  };
}

module.exports = {APP_ID, launchDetails};
