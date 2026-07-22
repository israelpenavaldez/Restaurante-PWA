import Button from './Button';

/**
 * Modal de confirmación para acciones destructivas o importantes.
 * Muestra un mensaje y dos botones: "Sí" para confirmar y "No" para cancelar.
 * Se superpone al contenido con un fondo semitransparente y desenfoque.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.message - Texto descriptivo de la acción a confirmar.
 * @param {Function} props.onConfirm - Función a ejecutar si el usuario confirma.
 * @param {Function} props.onCancel - Función a ejecutar si el usuario cancela.
 */
export default function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
        <p className="text-texto text-lg mb-6 text-center">{message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="cancel" onClick={onCancel}>No</Button>
          <Button variant="success" onClick={onConfirm}>Si</Button>
        </div>
      </div>
    </div>
  );
}