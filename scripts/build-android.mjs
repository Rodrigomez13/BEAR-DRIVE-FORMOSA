import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const env = {
  ...process.env,
  VITE_CAPACITOR: 'true',
  VITE_BASE44_APP_ID: process.env.VITE_BASE44_APP_ID || '6aa1902bd90ac5b66092d80d',
};
// Never ship a test APK that calls preview backend functions by accident.
if (env.VITE_BASE44_FUNCTIONS_VERSION === 'preview') {
  throw new Error('Android builds must use published functions. Unset VITE_BASE44_FUNCTIONS_VERSION=preview.');
}
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('npx', ['vite', 'build']);
run('npx', ['cap', 'sync', 'android']);
if (process.argv.includes('--sync-only')) process.exit(0);
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && !existsSync('android/local.properties')) {
  throw new Error('Android SDK missing. Set ANDROID_HOME or open android/ in Android Studio.');
}
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['assembleDebug', '--no-daemon'], `${process.cwd()}/android`);
