import React, { createContext, useState, useEffect, useContext, useRef  } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [isServiceOpen, setIsServiceOpen] = useState(true);
  const unsubscribeUserRef = useRef(null);
  const unsubscribeServiceRef = useRef(null);

  // Registro con email y password
  const register = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName,
      role: 'pending',
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    return userCredential.user;
  };

  // Login con email y password
  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  // Cerrar sesión
  const logout = async () => {
    // Limpiar suscripción antes de cerrar sesión
    if (unsubscribeUserRef.current) {
      unsubscribeUserRef.current();
      unsubscribeUserRef.current = null;
    }
    await signOut(auth);
    sessionStorage.removeItem('cachedUserData'); // limpiar caché
  };

  // Login con Google (maneja primer registro y vincula contraseña después)
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const googleUser = result.user;
    const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
    if (!userDoc.exists()) {
      setPendingGoogleUser(googleUser);
      return { isNew: true, user: googleUser };
    }
    return { isNew: false, user: googleUser };
  };

  // Establecer contraseña para usuario que se registró con Google
  const setGoogleUserPassword = async (password) => {
    if (!pendingGoogleUser) throw new Error('No hay usuario pendiente');
    await updatePassword(pendingGoogleUser, password);
    await setDoc(doc(db, 'users', pendingGoogleUser.uid), {
      email: pendingGoogleUser.email,
      displayName: pendingGoogleUser.displayName || '',
      role: 'pending',
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    const user = pendingGoogleUser;
    setPendingGoogleUser(null);
    return user;
  };

  // Escuchar cambios en el usuario autenticado y en sus datos
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      // Limpiar la suscripción anterior si existe
      if (unsubscribeUserRef.current) {
        unsubscribeUserRef.current();
        unsubscribeUserRef.current = null;
      }

      if (currentUser) {
        // Suscribirse a cambios en el documento del usuario
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            // Guardar en sessionStorage para recuperación offline
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
    loginWithGoogle,
    setGoogleUserPassword,
    pendingGoogleUser,
    isServiceOpen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};