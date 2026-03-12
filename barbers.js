import { auth, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection, setDoc, getDocs, deleteDoc, doc, query, getDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        await loadShopName(user.uid);
        loadBarbers();
        loadTimeOffRequests(); // Carrega as folgas assim que entra
    }
});

async function loadShopName(uid) {
    try {
        const shopSnap = await getDoc(doc(db, "barbershops", uid));
        const shopNameElement = document.getElementById("shop-name-sidebar");
        if (shopNameElement) {
            shopNameElement.innerText = shopSnap.exists() && shopSnap.data().name ? shopSnap.data().name : "BarberFlow";
        }
    } catch (error) { console.error("Erro:", error); }
}

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.querySelector("#logout-btn");
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });

    const form = document.querySelector("#barber-form");
    const btnSave = document.querySelector("#btn-save");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.querySelector("#barber-name").value.trim();
        const phone = document.querySelector("#barber-phone").value.trim();
        const commission = Number(document.querySelector("#barber-commission").value);
        const email = document.querySelector("#barber-email").value.trim();
        const password = document.querySelector("#barber-password").value.trim();

        if (!name || !phone || !email || !password || !commission) return alert("Preencha todos os campos.");

        btnSave.disabled = true;
        btnSave.innerText = "CRIANDO...";

        try {
            const secondaryApp = initializeApp(auth.app.options, "SecondaryApp" + Date.now());
            const secondaryAuth = getAuth(secondaryApp);
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const barberUid = userCred.user.uid;
            
            await signOutSecondary(secondaryAuth);

            await setDoc(doc(db, "barbershops", currentUser.uid, "barbers", barberUid), {
                name: name, phone: phone, email: email, commission: commission, createdAt: new Date()
            });

            await setDoc(doc(db, "users", barberUid), {
                role: "barber", barbershopId: currentUser.uid, email: email
            });

            form.reset();
            loadBarbers();
            alert("Barbeiro criado com sucesso! Ele já pode fazer login.");

        } catch (error) {
            console.error("Erro:", error);
            if (error.code === 'auth/email-already-in-use') alert("Este e-mail já está sendo usado.");
            else alert("Erro ao criar conta: " + error.message);
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = "Criar Conta";
        }
    });
});

async function loadBarbers() {
    const list = document.querySelector("#barbers-list");
    list.innerHTML = '<p class="text-xs text-gray-500 italic">Buscando equipe...</p>';

    const snapshot = await getDocs(query(collection(db, "barbershops", currentUser.uid, "barbers")));
    list.innerHTML = "";

    if (snapshot.empty) {
        list.innerHTML = '<p class="text-xs text-gray-500 italic">Nenhum barbeiro cadastrado.</p>';
        return;
    }

    snapshot.forEach((docItem) => {
        const barber = docItem.data();
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-gray-700 p-4 rounded-lg border border-gray-600";

        div.innerHTML = `
            <div class="flex-1">
                <p class="font-bold text-white text-sm flex items-center flex-wrap gap-2">
                    ${barber.name} 
                    <span class="text-accent text-[10px] bg-accent/10 px-2 py-1 rounded border border-accent/20 uppercase tracking-widest">${barber.commission}% Comissão</span>
                </p>
                <p class="text-xs text-gray-400 mt-2">
                    <span class="inline-block mr-3">📧 ${barber.email || 'Sem e-mail'}</span>
                    <span class="inline-block">📱 ${barber.phone}</span>
                </p>
            </div>
            <button data-id="${docItem.id}" class="delete-btn text-red-400 hover:text-white hover:bg-red-600 transition px-3 py-2 bg-red-500/10 rounded ml-4 font-bold text-xs uppercase">
                Excluir
            </button>
        `;
        list.appendChild(div);
    });

    attachDeleteEvents();
}

function attachDeleteEvents() {
    document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", async () => {
            if(confirm("Deseja remover este barbeiro? Ele perderá o acesso ao painel.")) {
                const id = button.getAttribute("data-id");
                await deleteDoc(doc(db, "barbershops", currentUser.uid, "barbers", id));
                await deleteDoc(doc(db, "users", id));
                loadBarbers();
            }
        });
    });
}

// -------------------------------------------------------------
// NOVA FUNÇÃO: GESTÃO DE FOLGAS
// -------------------------------------------------------------
async function loadTimeOffRequests() {
    const list = document.querySelector("#time-off-list");
    
    // Busca na subcoleção timeOffRequests apenas os que estão com status pendente
    const q = query(
        collection(db, "barbershops", currentUser.uid, "timeOffRequests"), 
        where("status", "==", "pendente")
    );
    
    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
        list.innerHTML = '<p class="text-xs text-gray-500 italic">Você não possui pedidos de folga pendentes.</p>';
        return;
    }

    snapshot.forEach((docItem) => {
        const req = docItem.data();
        
        // Formata a data de YYYY-MM-DD para DD/MM/YYYY
        const [year, month, day] = req.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-gray-900 p-4 rounded-lg border border-yellow-600/50 shadow-md";
        
        div.innerHTML = `
            <div>
                <p class="font-bold text-white">${req.barberName}</p>
                <p class="text-sm text-gray-400 mt-1">Solicitou folga para o dia: <span class="text-accent font-bold">${formattedDate}</span></p>
            </div>
            <div class="flex gap-2">
                <button onclick="respondFolga('${docItem.id}', 'aprovado')" class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white font-bold py-2 px-3 rounded text-xs uppercase transition">
                    ✓ Aprovar
                </button>
                <button onclick="respondFolga('${docItem.id}', 'recusado')" class="bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white font-bold py-2 px-3 rounded text-xs uppercase transition">
                    ✕ Recusar
                </button>
            </div>
        `;
        list.appendChild(div);
    });
}

// Essa função precisa estar no window (escopo global) porque o HTML do botão é injetado dinamicamente
window.respondFolga = async (id, newStatus) => {
    const actionText = newStatus === 'aprovado' ? 'APROVAR' : 'RECUSAR';
    
    if(confirm(`Tem certeza que deseja ${actionText} este pedido de folga?`)) {
        try {
            await updateDoc(doc(db, "barbershops", currentUser.uid, "timeOffRequests", id), {
                status: newStatus
            });
            alert(`Pedido ${newStatus} com sucesso!`);
            loadTimeOffRequests(); // Recarrega a lista para sumir o card
        } catch (e) {
            console.error(e);
            alert("Erro ao responder o pedido.");
        }
    }
};