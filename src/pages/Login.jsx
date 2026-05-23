import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const LoginView = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  const { notify } = useNotification();
  const { login, register, loginWithGoogle, setGoogleUserPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        await register(email, password, displayName);
        notify('Registro exitoso. Espera la aprobación del administrador.', 'success');
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.isNew) {
        setShowPasswordSetup(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetGooglePassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setGoogleUserPassword(newPassword);
      notify('Contraseña establecida. Ya puedes iniciar sesión con email y contraseña.', 'success');
      setShowPasswordSetup(false);
      setNewPassword('');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showPasswordSetup) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="w-full max-w-md">
          <h2 className="text-2xl font-display font-bold text-center text-texto mb-4">
            Completa tu registro
          </h2>
          <p className="text-texto-claro mb-4 text-center">
            Elige una contraseña para acceder también con email:
          </p>
          <form onSubmit={handleSetGooglePassword}>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Procesando...' : 'Guardar contraseña'}
            </Button>
          </form>
          {error && (
            <div className="bg-acento/10 text-acento p-2 rounded mt-4 text-sm">
              {error}
            </div>
          )}
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
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border-b-2 border-borde bg-transparent text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-4 transition-colors"
            required={isLogin}
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

          <Button type="submit" disabled={loading} className="w-full mb-3">
            {loading ? 'Procesando...' : isLogin ? 'Ingresar' : 'Registrarse'}
          </Button>
        </form>

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="warning"
          className="w-full mb-3"
        >
          Continuar con Google
        </Button>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-texto-claro hover:text-acento text-center text-sm transition-colors"
        >
          {isLogin
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </Card>
    </div>
  );
};

export default LoginView;