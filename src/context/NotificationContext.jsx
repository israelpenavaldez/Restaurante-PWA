import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import PromptModal from '../components/ui/PromptModal';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolveRef = useRef(null);
  const [promptState, setPromptState] = useState(null);
  const resolvePromptRef = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ message });
    });
  }, []);

  const handleConfirmResponse = (result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setConfirmState(null);
  };

  const prompt = useCallback((message, defaultValue = '') => {
    return new Promise((resolve) => {
      resolvePromptRef.current = resolve;
      setPromptState({ message, defaultValue });
    });
  }, []);

  const handlePromptResponse = (value) => {
    if (resolvePromptRef.current) {
      resolvePromptRef.current(value);
      resolvePromptRef.current = null;
    }
    setPromptState(null);
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm, prompt }}>
      {children}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-3">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
      {/* Modal de confirmación */}
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={() => handleConfirmResponse(true)}
          onCancel={() => handleConfirmResponse(false)}
        />
      )}
      {promptState && (
        <PromptModal
          message={promptState.message}
          defaultValue={promptState.defaultValue}
          onConfirm={(val) => handlePromptResponse(val)}
          onCancel={() => handlePromptResponse(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};