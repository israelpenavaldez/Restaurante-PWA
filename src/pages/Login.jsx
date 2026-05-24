import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

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

  // Redirige al dashboard solo si el usuario está habilitado
  useEffect(() => {
    if (user && userData) {
      if (userData.enabled && userData.role !== 'pending') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, userData, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        // Validaciones
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
        // Limpiar y volver a inicio de sesión
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

  return (
    <div className="flex justify-center items-center min-h-screen bg-fondo">
      <Card className="w-full max-w-md">
        <h2 className="text-3xl font-display font-bold text-center text-texto mb-6">
          {isLogin ? 'Iniciar Sesión' : 'Registro'}
        </h2>

        {error && (
          <div className="bg-acento/10 text-acento p-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
            required
          />
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
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
            required
          />
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