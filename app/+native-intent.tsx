import { router } from 'expo-router';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (initial) {
    return '/';
  }
  return router.canGoBack() ? path : '/';
}
