import { useState, useRef, useEffect } from 'react';
import Button from './Button';

export default function PromptModal({ message, onConfirm, onCancel, defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
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
    <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
        <p className="text-texto text-lg mb-4 text-center">{message}</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-2 border-b-2 border-borde bg-white rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition mb-6"
        />
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirm}>Aceptar</Button>
        </div>
      </div>
    </div>
  );
}