let localStorageAvailable = true;

try {
  const testKey = '__wrapped_artwork_test__';
  window.localStorage.setItem(testKey, '1');
  window.localStorage.removeItem(testKey);
} catch (error) {
  console.warn('Local storage unavailable, falling back to server artwork only.', error);
  localStorageAvailable = false;
}

export function readLocal(key) {
  if (!localStorageAvailable) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Local storage read failed; disabling custom artwork cache.', error);
    localStorageAvailable = false;
    return null;
  }
}

export function writeLocal(key, value) {
  if (!localStorageAvailable) {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Local storage write failed; disabling custom artwork cache.', error);
    localStorageAvailable = false;
    return false;
  }
}

export function removeLocal(key) {
  if (!localStorageAvailable) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Local storage removal failed.', error);
  }
}

export function writeSession(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    console.warn('Session storage write failed.', error);
  }
}

export function readSession(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.warn('Session storage read failed.', error);
    return null;
  }
}

export function removeSession(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('Session storage removal failed.', error);
  }
}
