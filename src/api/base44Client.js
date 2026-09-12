import { createClient } from '@base44/sdk';
import { Capacitor } from '@capacitor/core';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Native assets run at https://localhost, without Vite's /api proxy.
  serverUrl: Capacitor.isNativePlatform() ? appBaseUrl : '',
  appBaseUrl
});
