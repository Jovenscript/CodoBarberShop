import { auth, db } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Função da "Catraca Inteligente"
async function redirectBasedOnRole(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists() && userDoc.data().role === "barber") {
            window.location.href = "painel-barbeiro.html";
        } else {
            // Se não tiver na tabela users, é um Dono (pois donos não eram salvos lá no formato antigo)
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error("Erro ao verificar permissões:", error);
        window.location.href = "dashboard.html"; // Segurança
    }
}

// 🔐 Se já estiver logado, cai na catraca
onAuthStateChanged(auth, (user) => {
    if (user) {
        redirectBasedOnRole(user.uid);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#login-form");
    const btnSubmit = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.querySelector("#email").value.trim();
        const password = document.querySelector("#password").value.trim();

        if (!email || !password) {
            alert("Preencha todos os campos.");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerText = "VERIFICANDO...";

        try {
            // Faz o login no Firebase Auth
            await signInWithEmailAndPassword(auth, email, password);
            // Obs: Não precisamos dar window.location.href aqui, pois o onAuthStateChanged 
            // lá em cima vai detectar o login instantaneamente e rodar a catraca!

        } catch (error) {
            console.error("Erro no login:", error);
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Entrar"; // Restaura o botão

            switch (error.code) {
                case "auth/user-not-found":
                case "auth/invalid-credential":
                    alert("Usuário não encontrado ou senha incorreta.");
                    break;
                case "auth/wrong-password":
                    alert("Senha incorreta.");
                    break;
                case "auth/invalid-email":
                    alert("E-mail inválido.");
                    break;
                default:
                    alert("Erro ao fazer login.");
            }
        }
    });
});