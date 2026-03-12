import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, getDoc, setDoc, doc, query, where, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const carouselContainer = document.getElementById("date-carousel");
const selectedDateTitle = document.getElementById("selected-date-title");
const folgaStatusText = document.getElementById("folga-status");
const dayAppointmentsList = document.getElementById("day-appointments-list");
const shopNameSidebar = document.getElementById("shop-name-sidebar");

let currentBarberId = null;
let currentBarberName = "Conta de Teste";
let currentShopId = null;
let selectedDateStr = "";
let isBarberUser = false;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentBarberId = user.uid;
    await initializeCalendar();
});

async function initializeCalendar() {
    try {
        try {
            const userSnap = await getDoc(doc(db, "users", currentBarberId));
            if (userSnap.exists() && userSnap.data().role === "barber") {
                currentShopId = userSnap.data().barbershopId;
                isBarberUser = true;
            } else {
                currentShopId = currentBarberId;
                isBarberUser = false;
            }
        } catch(e) {
            currentShopId = currentBarberId;
            isBarberUser = false;
        }

        try {
            const shopSnap = await getDoc(doc(db, "barbershops", currentShopId));
            shopNameSidebar.innerText = shopSnap.exists() && shopSnap.data().name ? shopSnap.data().name : "BarberFlow";
        } catch(e) {}

        if (isBarberUser) {
            const barberSnap = await getDoc(doc(db, "barbershops", currentShopId, "barbers", currentBarberId));
            if (barberSnap.exists()) currentBarberName = barberSnap.data().name;
        }

        generateCarousel();

    } catch (error) {
        console.error("Erro ao inicializar calendário:", error);
        generateCarousel(); 
    }
}

function generateCarousel() {
    carouselContainer.innerHTML = "";
    const diasDaSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    let today = new Date();

    for (let i = 0; i < 30; i++) {
        let currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const diaSemanaStr = diasDaSemana[currentDate.getDay()];
        const diaNumeroStr = day;
        const mesStr = meses[currentDate.getMonth()];

        const card = document.createElement("div");
        card.className = "date-card flex-shrink-0 w-24 bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer border-2 border-transparent hover:border-gray-600 transition-all snap-center shadow-md";
        card.dataset.date = dateString;

        card.innerHTML = `
            <p class="text-xs text-gray-400 font-bold mb-1">${diaSemanaStr}</p>
            <p class="text-3xl font-black text-white">${diaNumeroStr}</p>
            <p class="text-xs text-accent font-bold mt-1">${mesStr}</p>
        `;

        card.addEventListener("click", () => selectDate(card, dateString, `${diaSemanaStr}, ${diaNumeroStr} de ${mesStr}`));
        carouselContainer.appendChild(card);

        if (i === 0) selectDate(card, dateString, `Hoje, ${diaNumeroStr} de ${mesStr}`);
    }
}

async function selectDate(cardElement, dateString, displayTitle) {
    document.querySelectorAll(".date-card").forEach(c => {
        c.classList.remove("border-accent", "bg-accent/10");
        c.classList.add("border-transparent", "bg-gray-800");
    });
    cardElement.classList.remove("border-transparent", "bg-gray-800");
    cardElement.classList.add("border-accent", "bg-accent/10");

    selectedDateStr = dateString;
    selectedDateTitle.innerText = displayTitle;
    
    await loadAgendaForDate(dateString);
}

async function loadAgendaForDate(targetDate) {
    dayAppointmentsList.innerHTML = `
        <div class="flex justify-center items-center py-10 opacity-50">
            <p class="text-accent animate-pulse font-bold tracking-widest uppercase text-xs">Sincronizando Agenda...</p>
        </div>`;
    
    folgaStatusText.innerText = "";

    try {
        // VERIFICA SE É DOMINGO
        // Forçamos o meio-dia (T12:00:00) para evitar problemas de fuso horário que podem mudar o dia
        const dateObj = new Date(targetDate + 'T12:00:00');
        const isSunday = dateObj.getDay() === 0;

        if (isSunday) {
            folgaStatusText.innerHTML = '<span class="text-gray-500">Barbearia Fechada</span>';
            dayAppointmentsList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 px-4 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                    <p class="text-5xl mb-4">😴</p>
                    <p class="text-gray-300 font-bold text-xl">Domingo é dia de descanso!</p>
                    <p class="text-gray-500 text-sm text-center mt-2">Aproveite sua folga semanal.</p>
                </div>
            `;
            return;
        }

        let hasFolga = false;
        let folgaStatus = "";

        if (isBarberUser) {
            const folgaRef = doc(db, "barbershops", currentShopId, "timeOffRequests", `${currentBarberId}_${targetDate}`);
            const folgaSnap = await getDoc(folgaRef);

            if (folgaSnap.exists()) {
                hasFolga = true;
                folgaStatus = folgaSnap.data().status;
                
                if (folgaStatus === "pendente") {
                    folgaStatusText.innerHTML = '<span class="text-yellow-500">⏳ Pedido de folga em análise pelo gestor.</span>';
                } else if (folgaStatus === "aprovado") {
                    folgaStatusText.innerHTML = '<span class="text-green-500">✅ Folga aprovada para este dia!</span>';
                } else if (folgaStatus === "recusado") {
                    folgaStatusText.innerHTML = '<span class="text-red-500">❌ Pedido de folga recusado.</span>';
                    hasFolga = false; // Permite tentar pedir de novo
                }
            }
        } else {
            folgaStatusText.innerHTML = '<span class="text-accent">Modo Gestor (Visão da sua própria agenda)</span>';
        }

        const q = query(
            collection(db, "barbershops", currentShopId, "appointments"),
            where("date", "==", targetDate),
            where("barberId", "==", currentBarberId),
            orderBy("time", "asc")
        );
        
        const snapshot = await getDocs(q);
        
        // SE NÃO TIVER CLIENTE, MOSTRA O BOTÃO GIGANTE NO MEIO DA TELA
        if (snapshot.empty) {
            let actionHtml = "";
            
            if (isBarberUser) {
                if (hasFolga && folgaStatus === 'pendente') {
                    actionHtml = `<button disabled class="mt-8 bg-yellow-600/20 text-yellow-500 border border-yellow-600 font-bold py-3 px-8 rounded-xl cursor-not-allowed">⏳ Folga em Análise</button>`;
                } else if (hasFolga && folgaStatus === 'aprovado') {
                    actionHtml = `<button disabled class="mt-8 bg-green-600/20 text-green-500 border border-green-600 font-bold py-3 px-8 rounded-xl cursor-not-allowed">✅ Aproveite sua Folga</button>`;
                } else {
                    actionHtml = `<button onclick="window.solicitarFolgaGlobal('${targetDate}')" class="mt-8 bg-gray-700 border border-gray-600 hover:bg-accent hover:text-black hover:border-accent text-gray-300 font-bold py-3 px-8 rounded-xl transition shadow-lg text-lg flex items-center gap-2">🏖️ Solicitar Folga Neste Dia</button>`;
                }
            }

            dayAppointmentsList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 px-4 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                    <div class="bg-gray-800 p-5 rounded-full mb-4 shadow-inner border border-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p class="text-gray-300 font-bold text-xl">Agenda Livre!</p>
                    <p class="text-gray-500 text-sm text-center mt-2 max-w-sm">Não há nenhum cliente agendado para você nesta data até o momento.</p>
                    ${actionHtml}
                </div>
            `;
            return; 
        }

        // SE TIVER CLIENTE, RENDERIZA OS CARDS
        dayAppointmentsList.innerHTML = "";
        snapshot.forEach((appoDoc) => {
            const data = appoDoc.data();
            const id = appoDoc.id;
            const isDone = data.status === "concluido";

            const card = document.createElement("div");
            card.className = `bg-gray-900 p-5 rounded-lg border-l-4 ${isDone ? 'border-green-500 opacity-60' : 'border-accent'} flex flex-col md:flex-row justify-between items-center shadow-md transition-all`;
            
            card.innerHTML = `
                <div class="flex-1 w-full mb-3 md:mb-0">
                    <div>
                        <span class="${isDone ? 'text-green-500' : 'text-accent'} font-bold text-xl mr-2">${data.time}</span>
                        <h4 class="font-bold ${isDone ? 'line-through text-gray-500' : 'text-white'} inline-block text-lg">${data.clientName}</h4>
                    </div>
                    <div class="text-sm text-gray-400 mt-2 flex gap-6">
                        <p>✂️ <span class="text-gray-300">${data.service}</span></p>
                        <p>💰 <span class="text-gray-300">R$ ${Number(data.price).toFixed(2)}</span></p>
                    </div>
                </div>
                
                <div class="flex gap-4 w-full md:w-auto justify-end items-center">
                    <p class="font-black ${isDone ? 'text-green-500' : 'text-yellow-500'} uppercase tracking-widest text-[10px]">${data.status}</p>
                    
                    ${isBarberUser && !isDone ? `
                    <button class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white px-5 py-2 rounded text-xs font-bold uppercase transition-all done-btn">
                        ✓ Finalizar
                    </button>` : ''}
                </div>
            `;

            if (isBarberUser && !isDone) {
                card.querySelector(".done-btn").addEventListener("click", async () => {
                    if(confirm("Confirmar que você finalizou este serviço?")) {
                        await updateDoc(doc(db, "barbershops", currentShopId, "appointments", id), { 
                            status: "concluido",
                            completedAt: serverTimestamp() 
                        });
                        loadAgendaForDate(targetDate); 
                    }
                });
            }

            dayAppointmentsList.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao puxar agenda:", error);
    }
}

// Função global para o botão injetado no HTML conseguir chamar
window.solicitarFolgaGlobal = async (targetDate) => {
    if (!confirm(`Solicitar folga para o dia ${targetDate.split('-').reverse().join('/')}?`)) return;

    try {
        const folgaId = `${currentBarberId}_${targetDate}`;
        const folgaRef = doc(db, "barbershops", currentShopId, "timeOffRequests", folgaId);

        await setDoc(folgaRef, {
            barberId: currentBarberId,
            barberName: currentBarberName,
            date: targetDate,
            status: "pendente",
            requestedAt: serverTimestamp()
        });

        alert("Pedido de folga enviado ao gestor!");
        await loadAgendaForDate(targetDate); 

    } catch (error) {
        console.error("Erro ao pedir folga:", error);
        alert("Erro ao pedir folga. Verifique sua conexão.");
    }
};

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));