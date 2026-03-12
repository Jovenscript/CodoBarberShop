// register.js

import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.querySelector("#register-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const barbershop = document.querySelector("#barbershop").value.trim();
        const email = document.querySelector("#email").value.trim();
        const password = document.querySelector("#password").value.trim();

        if (!barbershop || !email || !password) {
            alert("Preencha todos os campos.");
            return;
        }

        if (password.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        try {

            // 🔐 Cria usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 🏪 Salva dados da barbearia no Firestore
            await setDoc(doc(db, "barbershops", user.uid), {
                name: barbershop,
                email: email,
                createdAt: new Date()
            });

            alert("Conta criada com sucesso!");
            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Erro no cadastro:", error);

            switch (error.code) {
                case "auth/email-already-in-use":
                    alert("Esse e-mail já está em uso.");
                    break;
                case "auth/invalid-email":
                    alert("E-mail inválido.");
                    break;
                case "auth/weak-password":
                    alert("Senha fraca.");
                    break;
                default:
                    alert("Erro ao criar conta.");
            }
        }
    });

});