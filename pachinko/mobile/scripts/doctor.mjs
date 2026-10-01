import { toolchain } from './toolchain.mjs';

const { sdk, java } = toolchain();
const result = {
  node: process.version,
  nodeSupported: Number(process.versions.node.split('.')[0]) >= 22,
  androidSdk: sdk,
  javaHome: java,
  deviceTest: 'NOT_RUN',
};
console.log(JSON.stringify(result, null, 2));
if (!result.nodeSupported || !sdk || !java) process.exitCode = 1;
