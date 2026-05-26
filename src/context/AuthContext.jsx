import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isServiceOpen, setIsServiceOpen] = useState(true);
  const unsubscribeUserRef = useRef(null);
  const unsubscribeServiceRef = useRef(null);

  // Registro con email y password
  const register = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'users', uid), {
        email,
        displayName,
        role: 'pending',
        enabled: false,
        createdAt: new Date().toISOString(),
      });
      await signOut(auth);
      return userCredential.user;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este correo ya está registrado.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Correo electrónico no válido.');
      } else if (error.code === 'auth/password-does-not-meet-requirements') {
        throw new Error('La contraseña debe contener al menos una mayúscula, una minúscula y un carácter especial.');
      } else {
        throw error;
      }
    }
  };

  // Login con email y password
  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Correo o contraseña incorrectos.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No existe una cuenta con este correo.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Contraseña incorrecta.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Correo electrónico no válido.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Demasiados intentos. Intenta de nuevo más tarde.');
      } else {
        throw error;
      }
    }
  };

  // Cerrar sesión
  const logout = async () => {
    if (unsubscribeUserRef.current) {
      unsubscribeUserRef.current();
      unsubscribeUserRef.current = null;
    }
    await signOut(auth);
    sessionStorage.removeItem('cachedUserData');
  };

  // Recuperar contraseña
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Escuchar cambios en el usuario autenticado
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (unsubscribeUserRef.current) {
        unsubscribeUserRef.current();
        unsubscribeUserRef.current = null;
      }
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            try {
              sessionStorage.setItem('cachedUserData', JSON.stringify(data));
            } catch (e) { /* ignorar */ }
          } else {
            setUserData(null);
            sessionStorage.removeItem('cachedUserData');
          }
        });
        unsubscribeUserRef.current = unsubscribeSnapshot;
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserRef.current) unsubscribeUserRef.current();
    };
  }, []);

  // Suscripción al estado del servicio
  useEffect(() => {
    const configRef = doc(db, 'config', 'settings');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsServiceOpen(docSnap.data().isServiceOpen ?? true);
      } else {
        setIsServiceOpen(true);
      }
    });
    unsubscribeServiceRef.current = unsubscribe;
    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    register,
    login,
    logout,
    resetPassword,
    isServiceOpen,
    setIsServiceOpen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};