/**
 * Automated 1-Click APK Builder for School Management System
 *
 * Performs:
 * 1. Compiles React production bundle (npm run build)
 * 2. Syncs assets & plugins with Capacitor (npx cap sync android)
 * 3. Automatically locates OpenJDK 17/21
 * 4. Compiles the Live-Sync Android APK (gradlew assembleDebug)
 * 5. Copies the output APK to root directory for instant client delivery
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const androidDir = path.join(frontendDir, 'android');
const rootDir = path.resolve(frontendDir, '..');

console.log('====================================================');
console.log('🚀 BUILDING LIVE-SYNC ANDROID APK FOR CLIENT');
console.log('====================================================\n');

// 1. Find JDK 17 or 21
function findJavaHome() {
  const candidateDirs = [
    path.join(rootDir, 'jdk-21', 'jdk-21.0.6+7'),
    'C:\\Users\\vy305\\.jdks\\temurin-17\\jdk-17.0.20.1+1',
    'C:\\Users\\vy305\\.jdks\\temurin-21\\jdk-21.0.12.1+1',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17',
    'C:\\Program Files\\Java\\jdk-17',
    'C:\\Program Files\\Java\\jdk-21',
  ];

  for (const c of candidateDirs) {
    if (fs.existsSync(path.join(c, 'bin', 'java.exe'))) {
      return c;
    }
  }

  // Scan .jdks if not in standard list
  const jdksBase = 'C:\\Users\\vy305\\.jdks';
  if (fs.existsSync(jdksBase)) {
    const subs = fs.readdirSync(jdksBase);
    for (const s of subs) {
      const full = path.join(jdksBase, s);
      if (fs.statSync(full).isDirectory()) {
        if (fs.existsSync(path.join(full, 'bin', 'java.exe'))) return full;
        const inner = fs.readdirSync(full);
        for (const inn of inner) {
          const innFull = path.join(full, inn);
          if (fs.existsSync(path.join(innFull, 'bin', 'java.exe'))) return innFull;
        }
      }
    }
  }
  return null;
}

const javaHome = findJavaHome();
if (!javaHome) {
  console.error('❌ Error: Could not locate OpenJDK 17/21 on this system.');
  process.exit(1);
}

console.log(`[1/4] ✓ Using Java Home: ${javaHome}`);

// 2. Build Vite Frontend
console.log('\n[2/4] 📦 Compiling Vite React Frontend Bundle...');
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

// 3. Sync with Capacitor
console.log('\n[3/4] 🔄 Syncing Capacitor Android Assets...');
execSync('npx cap sync android', { cwd: frontendDir, stdio: 'inherit' });

// 4. Gradle Assemble
console.log('\n[4/4] 🔨 Compiling Android APK with Gradle...');
const env = { ...process.env, JAVA_HOME: javaHome };
const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

try {
  execSync(`${gradlewCmd} assembleDebug`, {
    cwd: androidDir,
    env,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('❌ Gradle build failed:', err.message);
  process.exit(1);
}

// 5. Copy Output APK to Root (Both names for convenience)
const debugApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destApk1 = path.join(rootDir, 'Aryavart_School_Portal_Live.apk');
const destApk2 = path.join(rootDir, 'AryavartPortal.apk');

if (fs.existsSync(debugApk)) {
  fs.copyFileSync(debugApk, destApk1);
  fs.copyFileSync(debugApk, destApk2);
  const stats = fs.statSync(destApk1);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n====================================================');
  console.log('🎉 LIVE-SYNC APK BUILT SUCCESSFULLY!');
  console.log('====================================================');
  console.log(`📁 Primary APK File:  ${destApk1}`);
  console.log(`📁 Alternative Name:  ${destApk2}`);
  console.log(`📊 File Size:         ${sizeMB} MB`);
  console.log(`⏱️ Generated At:      ${new Date().toLocaleString()}`);
  console.log('\n✨ Features Active in this APK:');
  console.log(' • Live Server URL: https://schoolmanagementwebapp-pf7m.onrender.com');
  console.log(' • Embedded Local Assets: Instant offline launch with zero "Not Found" errors');
  console.log(' • Native Capabilities: WhatsApp Direct Sharing, Excel & SQL Downloads');
  console.log('====================================================\n');
} else {
  console.error('❌ Error: Expected APK file not found at:', debugApk);
  process.exit(1);
}
