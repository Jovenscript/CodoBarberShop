import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, getDoc, doc, query, where, orderBy, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const appointmentsList = document.getElementById("appointments-list");
const filterDateInput = document.getElementById("filter-date");
const shopNameSidebar = document.getElementById("shop-name-sidebar");
const barberNameTitle = document.getElementById("barber-name-title");
const commissionTotalText = document.getElementById("barber-commission-total");

let currentBarberId = null;
let currentShopId = null;
let myCommissionRate = 0; // Ex: 50%

const today = new Date().toISOString().split('T')[0];
filterDateInput.value = today;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentBarberId = user.uid;
    await initializeBarberPanel();
});

async function initializeBarberPanel() {
    try {
        // 1. Puxa a relação de qual barbearia ele trabalha da tabela 'users'
        const userSnap = await getDoc(doc(db, "users", currentBarberId));
        if (!userSnap.exists() || userSnap.data().role !== "barber") {
            alert("Acesso negado.");
            auth.signOut();
            return;
        }
        
        currentShopId = userSnap.data().barbershopId;

        // 2. Puxa o nome da Barbearia
        const shopSnap = await getDoc(doc(db, "barbershops", currentShopId));
        shopNameSidebar.innerText = shopSnap.exists() ? shopSnap.data().name : "BarberFlow";

        // 3. Puxa os dados específicos do Barbeiro (Nome e Comissão)
        const barberSnap = await getDoc(doc(db, "barbershops", currentShopId, "barbers", currentBarberId));
        if (barberSnap.exists()) {
            const bData = barberSnap.data();
            barberNameTitle.innerText = bData.name;
            myCommissionRate = bData.commission || 0;
        }

        // 4. Carrega a agenda do dia
        loadMyAgenda(filterDateInput.value);

        filterDateInput.addEventListener("change", (e) => {
            loadMyAgenda(e.target.value);
        });

    } catch (error) {
        console.error("Erro na inicialização do painel:", error);
    }
}

async function loadMyAgenda(targetDate) {
    try {
        const q = query(
            collection(db, "barbershops", currentShopId, "appointments"),
            where("date", "==", targetDate),
            where("barberId", "==", currentBarberId), // SEGURANÇA: Só puxa os DELE!
            orderBy("time", "asc")
        );
        
        const snapshot = await getDocs(q);
        appointmentsList.innerHTML = "";
        
        let totalEarningsToday = 0;

        if (snapshot.empty) {
            appointmentsList.innerHTML = `<p class="text-gray-500 text-center py-4 italic text-sm">Nenhum cliente agendado para este dia.</p>`;
            commissionTotalText.innerText = "R$ 0,00";
            return;
        }

        snapshot.forEach((appoDoc) => {
            const data = appoDoc.data();
            const id = appoDoc.id;
            const isDone = data.status === "concluido";
            const price = Number(data.price);

            // Calcula a comissão do barbeiro (só soma se estiver concluído!)
            const myCut = price * (myCommissionRate / 100);
            if (isDone) {
                totalEarningsToday += myCut;
            }

            const viaSiteTag = data.viaPublic ? `<span class="bg-blue-600/20 text-blue-400 border border-blue-500/50 text-[10px] px-2 py-0.5 rounded ml-2 uppercase font-black tracking-widest animate-pulse inline-block">Via Site</span>` : '';

            const card = document.createElement("div");
            card.className = `bg-gray-800 p-4 rounded-lg border-l-4 ${isDone ? 'border-green-500 opacity-60' : 'border-accent'} flex flex-col md:flex-row justify-between items-center mb-3 shadow-md transition-all`;
            
            card.innerHTML = `
                <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 w-full mb-3 md:mb-0">
                    <div>
                        <span class="${isDone ? 'text-green-500' : 'text-accent'} font-bold text-lg">${data.time}</span>
                        <h4 class="font-semibold ${isDone ? 'line-through text-gray-500' : 'text-white'} flex items-center mt-1">
                            ${data.clientName} ${viaSiteTag}
                        </h4>
                    </div>
                    <div class="text-sm text-gray-400">
                        <p>✂️ Serviço: <span class="text-gray-300">${data.service}</span></p>
                        <p>💰 Total do Corte: R$ ${price.toFixed(2)}</p>
                    </div>
                    <div class="text-sm">
                        <p class="font-black ${isDone ? 'text-green-500' : 'text-yellow-500'} uppercase tracking-widest">${data.status}</p>
                        <p class="text-[10px] text-gray-400 uppercase mt-1">Minha Parte (${myCommissionRate}%):</p>
                        <p class="font-bold text-green-400">R$ ${myCut.toFixed(2)}</p>
                    </div>
                </div>
                
                <div class="flex gap-2 w-full md:w-auto justify-end">
                    ${!isDone ? `
                    <button class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white px-4 py-2 rounded text-xs font-bold uppercase transition-all done-btn">
                        ✓ Finalizar
                    </button>` : ''}
                </div>
            `;

            if (!isDone) {
                card.querySelector(".done-btn").addEventListener("click", async () => {
                    if(confirm("Confirmar que você finalizou este corte?")) {
                        await updateDoc(doc(db, "barbershops", currentShopId, "appointments", id), { 
                            status: "concluido",
                            completedAt: serverTimestamp() 
                        });
                        loadMyAgenda(targetDate); // Recarrega para atualizar a soma
                    }
                });
            }

            appointmentsList.appendChild(card);
        });

        // Atualiza a grana lá no topo!
        commissionTotalText.innerText = `R$ ${totalEarningsToday.toFixed(2)}`;

    } catch (error) {
        console.error("Erro ao puxar agenda:", error);
    }
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));