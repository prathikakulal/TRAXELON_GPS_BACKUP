import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEhfZ0z7bmHUpcz93UEOCfULfAjEu2BrI",
  authDomain: "traxelon-b4fed.firebaseapp.com",
  projectId: "traxelon-b4fed",
  storageBucket: "traxelon-b4fed.firebasestorage.app",
  messagingSenderId: "596504410021",
  appId: "1:596504410021:web:6a4671f3efe9b3bf301a4c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
