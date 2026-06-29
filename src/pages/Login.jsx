import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/**
 * Vista de inicio de sesión y registro.
 * Permite al usuario iniciar sesión con su correo y contraseña,
 * registrarse como nuevo usuario (quedando pendiente de aprobación),
 * o solicitar un enlace de recuperación de contraseña.
 */
const LoginView = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { notify } = useNotification();
  const { user, userData, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();

  /**
   * Redirige automáticamente al panel correspondiente si el usuario
   * ya está autenticado y su cuenta está habilitada.
   */
  useEffect(() => {
    if (user && userData) {
      if (userData.enabled && userData.role !== 'pending') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, userData, navigate]);

  /**
   * Maneja el envío del formulario, ya sea para iniciar sesión o para registrarse.
   * En el registro, valida que el nombre no esté vacío, que las contraseñas coincidan
   * y que la contraseña tenga al menos 6 caracteres.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        // Validaciones del formulario de registro
        if (!displayName.trim()) {
          setError('El nombre es obligatorio');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }

        await register(email, password, displayName.trim());
        notify('Registro exitoso. Espera la aprobación del administrador.', 'success');
        // Limpiar campos y volver a la vista de inicio de sesión
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setDisplayName('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Envía un correo de recuperación de contraseña al email ingresado.
   * Valida que el campo de email no esté vacío antes de enviar.
   */
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetEmailSent(true);
      notify('Correo de recuperación enviado', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== VISTA DE RECUPERACIÓN DE CONTRASEÑA =====
  if (showForgotPassword) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="w-full max-w-md">
          <h2 className="text-2xl font-display font-bold text-center text-texto mb-4">
            Recuperar contraseña
          </h2>
          {resetEmailSent ? (
            <p className="text-texto-claro text-center mb-4">
              Se ha enviado un enlace de recuperación a tu correo.
            </p>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </Button>
            </form>
          )}
          <button
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
            className="w-full text-acento hover:text-acento-hover text-center text-sm mt-4 transition-colors"
          >
            ← Volver al inicio de sesión
          </button>
        </Card>
      </div>
    );
  }

  // ===== VISTA PRINCIPAL (INICIO DE SESIÓN / REGISTRO) =====
  return (
    <div className="flex justify-center items-center min-h-screen bg-fondo">
      <Card className="w-full max-w-md">
        <h2 className="text-3xl font-display font-bold text-center text-texto mb-6">
          {isLogin ? 'Iniciar Sesión' : 'Registro'}
        </h2>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-acento/10 text-acento p-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email (siempre visible) */}
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
            required
          />
          {/* Nombre (solo en registro) */}
          {!isLogin && (
            <input
              type="text"
              placeholder="Nombre completo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
              required
            />
          )}
          {/* Contraseña */}
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
            required
          />
          {/* Confirmar contraseña (solo en registro) */}
          {!isLogin && (
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
              required
            />
          )}

          <Button type="submit" disabled={loading} className="w-full mb-3">
            {loading ? 'Procesando...' : isLogin ? 'Ingresar' : 'Registrarse'}
          </Button>
        </form>

        {/* Enlaces inferiores */}
        <div className="flex justify-between text-sm">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-texto-claro hover:text-acento transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
          {isLogin && (
            <button
              onClick={() => setShowForgotPassword(true)}
              className="text-texto-claro hover:text-acento transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LoginView;