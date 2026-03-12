import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const profileForm = document.getElementById("profile-form");
const emailInput = document.getElementById("profile-email");
const shopNameInput = document.getElementById("profile-shop-name");
const logoUrlInput = document.getElementById("profile-logo-url");
const shopOpenInput = document.getElementById("shop-open");
const shopCloseInput = document.getElementById("shop-close");
const whatsappInput = document.getElementById("profile-whatsapp");
const btnSaveProfile = document.getElementById("btn-save-profile");

const publicLinkInput = document.getElementById("public-link-input");
const copyLinkBtn = document.getElementById("copy-link-btn");

// Serviços
const serviceForm = document.getElementById("service-form");
const serviceNameInput = document.getElementById("service-name");
const servicePriceInput = document.getElementById("service-price");
const serviceDescInput = document.getElementById("service-desc");
const servicesList = document.getElementById("services-list");

let currentUserId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUserId = user.uid;
    emailInput.value = user.email;

    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    publicLinkInput.value = `${baseUrl}/agendar.html?id=${currentUserId}`;

    await loadProfile();
    await loadServices();
});

async function loadProfile() {
    try {
        const docRef = doc(db, "barbershops", currentUserId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            shopNameInput.value = data.name || "";
            logoUrlInput.value = data.logoUrl || "";
            whatsappInput.value = data.phone || "";
            shopOpenInput.value = data.openTime || "09:00";
            shopCloseInput.value = data.closeTime || "19:00";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSaveProfile.disabled = true;
    btnSaveProfile.innerText = "SALVANDO...";

    try {
        await setDoc(doc(db, "barbershops", currentUserId), {
            name: shopNameInput.value,
            logoUrl: logoUrlInput.value,
            phone: whatsappInput.value.replace(/\D/g, ''), 
            openTime: shopOpenInput.value,
            closeTime: shopCloseInput.value
        }, { merge: true });

        alert("Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar.");
    } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.innerText = "SALVAR ALTERAÇÕES";
    }
});

copyLinkBtn.addEventListener("click", () => {
    publicLinkInput.select();
    document.execCommand("copy");
    copyLinkBtn.innerText = "Copiado!";
    copyLinkBtn.classList.add("bg-green-500", "text-white");
    setTimeout(() => {
        copyLinkBtn.innerText = "Copiar";
        copyLinkBtn.classList.remove("bg-green-500", "text-white");
    }, 2000);
});

async function loadServices() {
    servicesList.innerHTML = '<p class="text-xs text-gray-500 italic text-center">Carregando serviços...</p>';
    try {
        const q = query(collection(db, "barbershops", currentUserId, "services"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        
        servicesList.innerHTML = "";
        
        if (querySnapshot.empty) {
            servicesList.innerHTML = '<p class="text-xs text-gray-500 italic text-center mt-4">Nenhum serviço cadastrado ainda.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const s = docSnap.data();
            const descHtml = s.description ? `<p class="text-[10px] text-gray-400 mt-1 italic">${s.description}</p>` : '';
            
            const li = document.createElement("li");
            li.className = "flex justify-between items-center bg-gray-700/50 p-3 rounded border border-gray-600";
            li.innerHTML = `
                <div class="flex-1 pr-4">
                    <div class="flex justify-between items-center">
                        <p class="font-bold text-sm text-white">${s.name}</p>
                        <p class="text-xs font-bold text-accent">R$ ${Number(s.price).toFixed(2)}</p>
                    </div>
                    ${descHtml}
                </div>
                <button class="text-red-400 hover:text-red-500 transition p-2" onclick="deleteService('${docSnap.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            `;
            servicesList.appendChild(li);
        });

    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        servicesList.innerHTML = '<p class="text-xs text-red-500 italic text-center">Erro ao buscar serviços.</p>';
    }
}

serviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = serviceForm.querySelector("button");
    btn.disabled = true;

    try {
        await addDoc(collection(db, "barbershops", currentUserId, "services"), {
            name: serviceNameInput.value.toUpperCase(),
            price: Number(servicePriceInput.value),
            description: serviceDescInput.value // Salvando a descrição
        });
        
        serviceForm.reset();
        await loadServices();
    } catch (error) {
        console.error("Erro ao adicionar serviço:", error);
        alert("Erro ao salvar serviço.");
    } finally {
        btn.disabled = false;
    }
});

window.deleteService = async (serviceId) => {
    if(confirm("Excluir este serviço? Ele não aparecerá mais para os clientes.")) {
        try {
            await deleteDoc(doc(db, "barbershops", currentUserId, "services", serviceId));
            await loadServices();
        } catch (error) {
            console.error("Erro ao deletar:", error);
        }
    }
};

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));