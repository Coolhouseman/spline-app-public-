import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    console.log('[RootNavigation] Navigating to:', name);
    navigationRef.dispatch(
      CommonActions.navigate({
        name,
        params,
      })
    );
  } else {
    console.log('[RootNavigation] Navigator not ready, will retry navigation to:', name);
    // Retry after a short delay - the navigator should be ready after the app resumes
    const retryNavigation = (attempts: number) => {
      setTimeout(() => {
        if (navigationRef.isReady()) {
          console.log('[RootNavigation] Retry successful, navigating to:', name);
          navigationRef.dispatch(
            CommonActions.navigate({
              name,
              params,
            })
          );
        } else if (attempts > 0) {
          console.log('[RootNavigation] Still not ready, retrying...', attempts, 'attempts left');
          retryNavigation(attempts - 1);
        } else {
          console.warn('[RootNavigation] Navigator never became ready, could not navigate to:', name);
        }
      }, 100);
    };
    retryNavigation(20); // Try up to 20 times (2 seconds total)
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
