/**
 * Botón con variantes temáticas
 * @param {string} variant - 'primary' | 'secondary' | 'success' | 'warning'
 */
const variants = {
  primary: 'bg-boton-primario hover:bg-boton-primario-hover text-boton-primario-texto',
  secondary: 'bg-boton-secundario hover:bg-boton-secundario-hover text-boton-secundario-texto',
  success: 'bg-boton-exito hover:bg-boton-exito-hover text-boton-exito-texto',
  warning: 'bg-boton-aviso hover:bg-boton-aviso-hover text-boton-aviso-texto',
};

export default function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button
      className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}