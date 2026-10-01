import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toolchain } from './toolchain.mjs';

const android = fileURLToPath(new URL('../android/', import.meta.url));
const { sdk, java } = toolchain();
if (!sdk || !java) {
  console.error('ANDROID_TOOLCHAIN_MISSING: Android SDK platform 36 and JDK21 are required.');
  process.exit(2);
}
const win = process.platform === 'win32';
const result = spawnSync(win ? 'cmd.exe' : './gradlew', win
  ? ['/d', '/s', '/c', 'gradlew.bat clean assembleDebug assembleRelease bundleRelease --no-daemon --console=plain']
  : ['clean', 'assembleDebug', 'assembleRelease', 'bundleRelease', '--no-daemon', '--console=plain'], {
    cwd: android,
    stdio: 'inherit',
    env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: java },
  });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
