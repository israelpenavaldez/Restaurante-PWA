/**
 * Interruptor (toggle) para estados binarios.
 * Utiliza los mismos colores de botones definidos en el tema.
 *
 * @param {boolean} enabled - Estado actual del toggle.
 * @param {Function} onChange - Callback que recibe el nuevo estado.
 * @param {string} [label] - Etiqueta opcional al lado del toggle.
 * @param {boolean} [disabled] - Si está deshabilitado.
 */
export default function Toggle({ enabled, onChange, label, disabled = false }) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      {label && <span className="text-sm text-texto">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-acento focus:ring-offset-2 ${
          enabled ? 'bg-boton-exito' : 'bg-borde-claro'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}