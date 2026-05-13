import { useState, useCallback } from 'react';

export const useActionLock = () => {
  const [isLocked, setIsLocked] = useState(false);

  const withLock = useCallback(async (action, onError) => {
    if (isLocked) return;
    setIsLocked(true);
    try {
      await action();
    } catch (error) {
      if (onError) onError(error);
      else console.error(error);
    } finally {
      setIsLocked(false);
    }
  }, [isLocked]);

  return { withLock, isLocked };
};