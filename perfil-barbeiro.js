import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const bioForm = document.getElementById("bio-form");
const avatarInput = document.getElementById("barber-avatar-input");
const bioInput = document.getElementById("barber-bio-input");

const postForm = document.getElementById("post-form");
const postImgUrl = document.getElementById("post-img-url");
const postDesc = document.getElementById("post-desc");
const postsList = document.getElementById("posts-list");

let currentBarberId = null;
let currentShopId = null;
let galleryData = []; // Aqui vamos guardar a lista de fotos do portfólio

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentBarberId = user.uid;
    await initializeProfilePanel();
});

async function initializeProfilePanel() {
    try {
        // 1. Descobre a barbearia do barbeiro logado
        const userSnap = await getDoc(doc(db, "users", currentBarberId));
        if (!userSnap.exists() || userSnap.data().role !== "barber") {
            alert("Acesso negado.");
            auth.signOut();
            return;
        }
        currentShopId = userSnap.data().barbershopId;

        // 2. Carrega os dados do Perfil dele
        loadBarberProfile();

    } catch (error) {
        console.error("Erro na inicialização do perfil:", error);
    }
}

async function loadBarberProfile() {
    try {
        const barberRef = doc(db, "barbershops", currentShopId, "barbers", currentBarberId);
        const barberSnap = await getDoc(barberRef);

        if (barberSnap.exists()) {
            const data = barberSnap.data();

            // Preenche os campos de Bio se já tiver salvo antes
            if (data.avatarUrl) avatarInput.value = data.avatarUrl;
            if (data.bio) bioInput.value = data.bio;

            // Carrega a galeria
            galleryData = data.gallery || []; 
            renderGallery();
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// Renderiza a grade de fotos postadas (Abaixo do formulário)
function renderGallery() {
    postsList.innerHTML = "";

    if (galleryData.length === 0) {
        postsList.innerHTML = `<p class="text-xs text-gray-500 italic col-span-2">Você ainda não publicou nenhuma foto no portfólio.</p>`;
        return;
    }

    // Inverte o array para a foto mais nova aparecer primeiro
    const reversedGallery = [...galleryData].reverse();

    reversedGallery.forEach((item, index) => {
        // Cuidado: index aqui é do array invertido, se for excluir, precisa achar o índice real
        const realIndex = galleryData.length - 1 - index;

        postsList.innerHTML += `
            <div class="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <img src="${item.img}" alt="Corte" class="w-full h-full object-cover">
                
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-300 p-2 flex flex-col justify-between">
                    <p class="text-[10px] text-white font-bold leading-tight">${item.desc}</p>
                    
                    <button class="bg-red-500 text-white p-1.5 rounded-full self-end hover:bg-red-600 transition shadow-lg btn-delete-post" data-index="${realIndex}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    });

    if(window.lucide) window.lucide.createIcons();

    // Adiciona o evento de excluir foto
    document.querySelectorAll('.btn-delete-post').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            if(confirm("Tem certeza que deseja apagar essa foto do seu portfólio?")) {
                await deletePost(idx);
            }
        });
    });
}

// SALVAR DADOS DA BIO E FOTO
bioForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = bioForm.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerText;
    
    btnSubmit.innerText = "SALVANDO...";
    btnSubmit.disabled = true;

    try {
        const barberRef = doc(db, "barbershops", currentShopId, "barbers", currentBarberId);
        
        await updateDoc(barberRef, {
            avatarUrl: avatarInput.value,
            bio: bioInput.value
        });

        btnSubmit.innerText = "SALVO COM SUCESSO!";
        btnSubmit.classList.replace("bg-accent", "bg-green-500");
        
        setTimeout(() => {
            btnSubmit.innerText = originalText;
            btnSubmit.classList.replace("bg-green-500", "bg-accent");
            btnSubmit.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Erro ao salvar Bio:", error);
        alert("Erro ao salvar perfil.");
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
    }
});

// ADICIONAR NOVA FOTO NO PORTFÓLIO
postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = postForm.querySelector('button[type="submit"]');
    btnSubmit.innerText = "Adicionando...";
    btnSubmit.disabled = true;

    const newPost = {
        img: postImgUrl.value,
        desc: postDesc.value
    };

    // Adiciona o novo post no array existente
    galleryData.push(newPost);

    try {
        const barberRef = doc(db, "barbershops", currentShopId, "barbers", currentBarberId);
        await updateDoc(barberRef, {
            gallery: galleryData // Atualiza o Firebase com o array novo
        });

        // Limpa os campos
        postImgUrl.value = "";
        postDesc.value = "";
        
        // Renderiza a galeria de novo
        renderGallery();

    } catch (error) {
        console.error("Erro ao adicionar foto:", error);
        alert("Erro ao salvar foto.");
        // Se deu erro, remove do array local
        galleryData.pop(); 
    }

    btnSubmit.innerText = "Adicionar ao Portfólio";
    btnSubmit.disabled = false;
});

// DELETAR FOTO DO PORTFÓLIO
async function deletePost(index) {
    // Remove o item específico do array local
    galleryData.splice(index, 1);

    try {
        const barberRef = doc(db, "barbershops", currentShopId, "barbers", currentBarberId);
        await updateDoc(barberRef, {
            gallery: galleryData // Salva o array atualizado (sem a foto) no Firebase
        });

        renderGallery(); // Atualiza a tela

    } catch (error) {
        console.error("Erro ao deletar foto:", error);
        alert("Erro ao deletar foto.");
        loadBarberProfile(); // Recarrega os dados do banco por segurança
    }
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));