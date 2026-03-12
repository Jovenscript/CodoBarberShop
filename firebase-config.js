import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbxyuPA2NY37LT6T4niTIvr15SlQnUQNY",
  authDomain: "barber-flow-fd7ae.firebaseapp.com",
  projectId: "barber-flow-fd7ae",
  storageBucket: "barber-flow-fd7ae.firebasestorage.app",
  messagingSenderId: "663169706804",
  appId: "1:663169706804:web:928928706572e7495e5361"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);