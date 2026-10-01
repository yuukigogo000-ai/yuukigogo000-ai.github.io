import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function toolchain() {
  const tools = fileURLToPath(new URL('../../../../_tools/', import.meta.url));
  const requestedSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const sdkCandidates = requestedSdk ? [requestedSdk] : [
    path.join(tools, 'android-sdk'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android/Sdk'),
  ].filter(Boolean);
  const sdk = sdkCandidates.find(p => existsSync(path.join(p, 'platforms/android-36/android.jar'))) || null;
  const javaCandidates = process.env.JAVA_HOME ? [process.env.JAVA_HOME] : [path.join(tools, 'jdk-21.0.12.1+1')];
  const java = javaCandidates.find(p => existsSync(path.join(p, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) || null;
  return { sdk, java };
}
