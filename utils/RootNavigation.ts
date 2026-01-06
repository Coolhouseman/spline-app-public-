import { createNavigationContainerRef, CommonActions, StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

interface PendingNav {
  name: string;
  params?: object;
  timestamp: number;
}

let pendingNavigation: PendingNav | null = null;
let onReadyCallbacks: (() => void)[] = [];

export function isReady(): boolean {
  return navigationRef.isReady();
}

export function onNavigationReady(callback: () => void) {
  if (navigationRef.isReady()) {
    callback();
  } else {
    onReadyCallbacks.push(callback);
  }
}

export function notifyReady() {
  console.log('[RootNavigation] Navigator is ready, processing callbacks');
  onReadyCallbacks.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('[RootNavigation] Callback error:', e);
    }
  });
  onReadyCallbacks = [];
  
  if (pendingNavigation && Date.now() - pendingNavigation.timestamp < 10000) {
    console.log('[RootNavigation] Processing pending navigation to:', pendingNavigation.name);
    setTimeout(() => {
      if (pendingNavigation) {
        performNavigation(pendingNavigation.name, pendingNavigation.params);
        pendingNavigation = null;
      }
    }, 500);
  }
}

function performNavigation(name: string, params?: object) {
  if (!navigationRef.isReady()) {
    console.warn('[RootNavigation] Cannot navigate - navigator not ready');
    return;
  }
  
  console.log('[RootNavigation] Performing navigation to:', name, 'params:', JSON.stringify(params));
  
  try {
    navigationRef.dispatch(
      CommonActions.navigate({
        name,
        params,
      })
    );
  } catch (error) {
    console.error('[RootNavigation] Navigation dispatch error:', error);
  }
}

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    performNavigation(name, params);
  } else {
    console.log('[RootNavigation] Navigator not ready, queueing navigation to:', name);
    pendingNavigation = { name, params, timestamp: Date.now() };
    
    const retryNavigation = (attempts: number) => {
      setTimeout(() => {
        if (navigationRef.isReady() && pendingNavigation) {
          console.log('[RootNavigation] Retry successful, navigating to:', pendingNavigation.name);
          performNavigation(pendingNavigation.name, pendingNavigation.params);
          pendingNavigation = null;
        } else if (attempts > 0 && pendingNavigation) {
          retryNavigation(attempts - 1);
        } else if (pendingNavigation) {
          console.warn('[RootNavigation] Navigator never became ready after retries');
        }
      }, 200);
    };
    retryNavigation(25);
  }
}

export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
}

export function reset(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name, params }],
      })
    );
  }
}

export function hasPendingNavigation(): boolean {
  return pendingNavigation !== null;
}

export function clearPendingNavigation() {
  pendingNavigation = null;
}
