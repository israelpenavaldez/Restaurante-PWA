import { useState, useRef, useEffect } from 'react';
import Button from './Button';

/**
 * Modal de entrada de texto.
 * Muestra un mensaje y un campo de entrada, permitiendo al usuario
 * ingresar un valor y confirmarlo o cancelar la operación.
 * Se superpone al contenido con un fondo semitransparente y desenfoque.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.message - Texto descriptivo que se muestra al usuario.
 * @param {Function} props.onConfirm - Función que se ejecuta al confirmar, recibe el valor ingresado.
 * @param {Function} props.onCancel - Función que se ejecuta al cancelar.
 * @param {string} [props.defaultValue=''] - Valor inicial del campo de entrada.
 */
export default function PromptModal({ message, onConfirm, onCancel, defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  // Enfoca automáticamente el campo de entrada al abrirse el modal
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /** Confirma la operación pasando el valor ingresado (sin espacios al inicio ni al final). */
  const handleConfirm = () => {
    onConfirm(value.trim());
  };

  /**
   * Maneja los atajos de teclado:
   * - Enter: confirma la operación.
   * - Escape: cancela la operación.
   */
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