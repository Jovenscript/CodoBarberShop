import { auth, db } from "./firebase-config.js";
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, query } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        await loadShopName(user.uid);
        loadClients();
    }
});

async function loadShopName(uid) {
    try {
        const shopSnap = await getDoc(doc(db, "barbershops", uid));
        const shopNameElement = document.getElementById("shop-name-sidebar");
        if (shopNameElement) {
            shopNameElement.innerText = shopSnap.exists() && shopSnap.data().name ? shopSnap.data().name : "BarberFlow";
        }
    } catch (error) { console.error("Erro ao buscar nome:", error); }
}

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.querySelector("#logout-btn");
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#client-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.querySelector("#client-name").value.trim();
        const phone = document.querySelector("#client-phone").value.trim();

        if (!name || !phone) return alert("Preencha todos os campos.");

        try {
            await addDoc(collection(db, "barbershops", currentUser.uid, "clients"), {
                name: name, phone: phone, createdAt: new Date()
            });
            form.reset();
            loadClients();
        } catch (error) { console.error("Erro ao salvar cliente:", error); }
    });
});

async function loadClients() {
    const list = document.querySelector("#clients-list");
    list.innerHTML = "";
    const snapshot = await getDocs(query(collection(db, "barbershops", currentUser.uid, "clients")));

    snapshot.forEach((docItem) => {
        const client = docItem.data();
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-gray-700 p-4 rounded-lg";
        div.innerHTML = `
            <div>
                <p class="font-semibold">${client.name}</p>
                <p class="text-sm text-gray-400">${client.phone}</p>
            </div>
            <button data-id="${docItem.id}" class="delete-btn text-red-400 hover:text-red-600 transition">Excluir</button>
        `;
        list.appendChild(div);
    });
    attachDeleteEvents();
}

function attachDeleteEvents() {
    document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", async () => {
            if(confirm("Deseja mesmo excluir este cliente?")) {
                const id = button.getAttribute("data-id");
                await deleteDoc(doc(db, "barbershops", currentUser.uid, "clients", id));
                loadClients();
            }
        });
    });
}