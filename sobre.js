import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Pega os IDs da Barbearia e do Barbeiro na URL
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('shopId');
const barberId = urlParams.get('barberId');

const headerName = document.getElementById("header-name");
const barberNameEl = document.getElementById("barber-name");
const barberBioEl = document.getElementById("barber-bio");
const barberAvatarEl = document.getElementById("barber-avatar");
const galleryGrid = document.getElementById("gallery-grid");
const btnAgendar = document.getElementById("btn-agendar");

async function carregarPerfilBarbeiro() {
    if (!shopId || !barberId) {
        barberBioEl.innerText = "Erro: Profissional não encontrado.";
        barberNameEl.innerText = "Ops!";
        return;
    }

    try {
        // Busca os dados do barbeiro no banco
        const barberRef = doc(db, "barbershops", shopId, "barbers", barberId);
        const barberSnap = await getDoc(barberRef);

        if (barberSnap.exists()) {
            const data = barberSnap.data();

            // Preenche os textos
            headerName.innerText = data.name.split(' ')[0]; // Pega só o primeiro nome
            barberNameEl.innerText = data.name;
            
            // Bio
            barberBioEl.innerText = data.bio || `Olá, eu sou o ${data.name}. Tenho paixão por cortes modernos e atendimento de qualidade. Meu objetivo é fazer você sair daqui com a autoestima lá em cima!`;

            // Foto de perfil
            if (data.avatarUrl) {
                barberAvatarEl.src = data.avatarUrl;
            }

            // Renderiza a galeria de fotos com as legendas
            galleryGrid.innerHTML = ""; 
            
            if (data.gallery && data.gallery.length > 0) {
                // Inverte para a foto mais nova aparecer primeiro
                const reversedGallery = [...data.gallery].reverse();

                reversedGallery.forEach(item => {
                    galleryGrid.innerHTML += `
                        <div class="relative group aspect-square bg-gray-900 overflow-hidden cursor-pointer">
                            <img src="${item.img}" alt="${item.desc}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300">
                            
                            <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition duration-300 p-2 flex items-center justify-center text-center">
                                <p class="text-[10px] md:text-xs text-white font-bold tracking-wide leading-tight">${item.desc}</p>
                            </div>
                        </div>
                    `;
                });
            } else {
                galleryGrid.innerHTML = `
                    <div class="col-span-3 text-center py-10 text-gray-600 text-xs italic">
                        Este profissional ainda não adicionou fotos ao portfólio.
                    </div>
                `;
            }

            // Manda o cliente para a página de agendamento já com o barbeiro selecionado
            btnAgendar.addEventListener("click", () => {
                window.location.href = `agendar.html?shopId=${shopId}&barberId=${barberId}`;
            });

        } else {
            barberBioEl.innerText = "Barbeiro não encontrado.";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        barberBioEl.innerText = "Erro de conexão.";
    }
}

// Inicia
carregarPerfilBarbeiro();