import { useState, useRef, useEffect } from 'react';
import Button from './Button';

export default function PromptModal({ message, onConfirm, onCancel, defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    // Enfocar automáticamente el input
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    onConfirm(value.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="fixed inset-0 bg-chocolate-oscuro/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-hueso rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-barro-claro/30">
        <p className="text-chocolate-oscuro text-lg mb-4 text-center">{message}</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-2 border-b-2 border-barro-claro bg-white rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition mb-6"
        />
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirm}>Aceptar</Button>
        </div>
      </div>
    </div>
  );
}