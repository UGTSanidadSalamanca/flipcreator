import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "vototrack-7z8mi",
  appId: "1:989242889334:web:0573d235e1486a609bfb57",
  storageBucket: "vototrack-7z8mi.appspot.com", // Fallback to classic domain to avoid CORS issues
  apiKey: "AIzaSyBHkII87j4-4I4J6Yj88xt0NbzWCeZttDk",
  authDomain: "vototrack-7z8mi.firebaseapp.com",
  messagingSenderId: "989242889334"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
