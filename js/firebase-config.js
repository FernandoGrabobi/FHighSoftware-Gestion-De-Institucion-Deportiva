// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCuO6fezN9755uiH2wD10n2ilsOju6pocM",
  authDomain: "comerciogestion-6ef41.firebaseapp.com",
  projectId: "comerciogestion-6ef41",
  storageBucket: "comerciogestion-6ef41.firebasestorage.app",
  messagingSenderId: "596807100656",
  appId: "1:596807100656:web:93dbea4183925b6eecba35",
  measurementId: "G-4CC2CTBMBY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);