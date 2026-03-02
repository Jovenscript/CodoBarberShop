import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4kbWll_8cpv7QUWNAXJgPaSThMRVYqFo",
  authDomain: "savings-control-a85b9.firebaseapp.com",
  projectId: "savings-control-a85b9",
  storageBucket: "savings-control-a85b9.firebasestorage.app",
  messagingSenderId: "1054481790356",
  appId: "1:1054481790356:web:61ae281b114e07a61d8b81"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);