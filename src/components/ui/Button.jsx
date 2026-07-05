/**
 * Botón reutilizable con variantes de estilo temáticas.
 * Soporta cuatro variantes predefinidas que aplican colores de fondo,
 * texto y efectos hover consistentes con el diseño del sistema.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Contenido del botón.
 * @param {string} [props.variant='primary'] - Variante de estilo:
 *   'primary' | 'secondary' | 'success' | 'warning'.
 * @param {string} [props.className=''] - Clases CSS adicionales.
 * @param {Object} [props...] - Resto de propiedades estándar de un <button>.
 */
export default function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  /** Mapeo de variantes a clases de Tailwind. */
  const variants = {
    primary: 'bg-boton-primario hover:bg-boton-primario-hover text-boton-primario-texto',
    secondary: 'bg-boton-secundario hover:bg-boton-secundario-hover text-boton-secundario-texto',
    success: 'bg-boton-exito hover:bg-boton-exito-hover text-boton-exito-texto',
    warning: 'bg-boton-aviso hover:bg-boton-aviso-hover text-boton-aviso-texto',
  };

  return (
    <button
      className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}