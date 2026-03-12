import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, 
    doc, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const appointmentForm = document.getElementById("appointment-form");
const clientSelect = document.getElementById("appointment-client");
const barberSelect = document.getElementById("appointment-barber");
const serviceSelect = document.getElementById("appointment-service");
const priceInput = document.getElementById("appointment-price");
const timeSelect = document.getElementById("appointment-time");
const dateInput = document.getElementById("appointment-date");
const appointmentsList = document.getElementById("appointments-list");

const today = new Date().toISOString().split('T')[0];
if (dateInput) dateInput.value = today;

function populateTimeSlots() {
    if (!timeSelect) return;
    const times = [
        "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
        "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", 
        "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
    ];
    timeSelect.innerHTML = '<option value="">Selecione o Horário</option>';
    times.forEach(t => {
        timeSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
}
populateTimeSlots();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    const userId = user.uid;

    try {
        await loadShopName(userId);
        await loadOptions(userId, "clients", clientSelect);
        await loadOptions(userId, "barbers", barberSelect);
        await loadServices(userId, serviceSelect);
    } catch (e) {
        console.error("Erro ao puxar dados do banco:", e);
    }
    
    // Sempre carrega a lista baseada na data que está no input do painel
    renderAppointments(userId, dateInput.value);
    
    // Se você mudar a data no painel, ele recarrega a lista
    dateInput.addEventListener("change", (e) => renderAppointments(userId, e.target.value));

    if (serviceSelect) {
        serviceSelect.addEventListener("change", (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const price = selectedOption.getAttribute("data-price");
            priceInput.value = price ? Number(price).toFixed(2) : "";
        });
    }

    if (appointmentForm) {
        appointmentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const selectedDate = dateInput.value;
            const selectedTime = timeSelect.value;
            const selectedBarberId = barberSelect.value;
            const selectedServiceOption = serviceSelect.options[serviceSelect.selectedIndex];
            
            if (!selectedTime || !selectedServiceOption.value) return alert("Preencha todos os campos obrigatórios.");

            try {
                const qConflict = query(
                    collection(db, "barbershops", userId, "appointments"),
                    where("date", "==", selectedDate),
                    where("time", "==", selectedTime),
                    where("barberId", "==", selectedBarberId)
                );
                const conflictSnap = await getDocs(qConflict);
                
                if (!conflictSnap.empty) {
                    alert("Este barbeiro já tem um cliente neste horário!");
                    return;
                }

                const clientSnap = await getDoc(doc(db, "barbershops", userId, "clients", clientSelect.value));
                const clientData = clientSnap.data();

                const newAppointment = {
                    clientId: clientSelect.value,
                    clientName: clientData.name,
                    clientPhone: clientData.phone || "",
                    barberId: selectedBarberId,
                    barberName: barberSelect.options[barberSelect.selectedIndex].text,
                    date: selectedDate,
                    time: selectedTime,
                    service: selectedServiceOption.text.split(" - R$")[0], 
                    price: Number(priceInput.value),
                    status: "pendente",
                    createdAt: serverTimestamp(),
                    viaPublic: false // FOI O DONO QUE CADASTROU (Não vai mostrar a tag azul)
                };

                await addDoc(collection(db, "barbershops", userId, "appointments"), newAppointment);
                
                timeSelect.value = "";
                serviceSelect.value = "";
                priceInput.value = "";
                
                renderAppointments(userId, selectedDate);
                alert("Agendado com sucesso!");

            } catch (error) {
                console.error("Erro no processo:", error);
            }
        });
    }
});

// Busca o nome da barbearia para injetar no Menu Lateral
async function loadShopName(uid) {
    try {
        const shopSnap = await getDoc(doc(db, "barbershops", uid));
        const shopNameElement = document.getElementById("shop-name-sidebar");
        if (shopNameElement) {
            shopNameElement.innerText = shopSnap.exists() && shopSnap.data().name ? shopSnap.data().name : "BarberFlow";
        }
    } catch (error) {
        console.error("Erro ao buscar nome:", error);
    }
}

async function loadOptions(uid, path, selectEl) {
    if (!selectEl) return;
    const q = query(collection(db, "barbershops", uid, path), orderBy("name", "asc"));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        selectEl.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}

async function loadServices(uid, selectEl) {
    if (!selectEl) return;
    const q = query(collection(db, "barbershops", uid, "services"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        const s = doc.data();
        selectEl.innerHTML += `<option value="${doc.id}" data-price="${s.price}">${s.name} - R$ ${Number(s.price).toFixed(2)}</option>`;
    });
}

async function renderAppointments(uid, filterDate) {
    const q = query(
        collection(db, "barbershops", uid, "appointments"),
        where("date", "==", filterDate),
        orderBy("time", "asc")
    );
    
    const snapshot = await getDocs(q);
    appointmentsList.innerHTML = "";

    if (snapshot.empty) {
        appointmentsList.innerHTML = `<p class="text-gray-500 text-center py-4 italic">Sem compromissos marcados para este dia.</p>`;
        return;
    }

    const shopSnap = await getDoc(doc(db, "barbershops", uid));
    const shopName = shopSnap.data()?.name || "Barbearia";

    snapshot.forEach((appoDoc) => {
        const data = appoDoc.data();
        const id = appoDoc.id;
        const isDone = data.status === "concluido";

        const msg = encodeURIComponent(`Olá ${data.clientName}! Confirmamos seu horário na ${shopName} hoje às ${data.time}. Te esperamos!`);
        const whatsappUrl = `https://wa.me/${data.clientPhone?.replace(/\D/g,'')}?text=${msg}`;

        // Tag visual para identificar agendamentos do cliente
        const viaSiteTag = data.viaPublic 
            ? `<span class="bg-blue-600/20 text-blue-400 border border-blue-500/50 text-[10px] px-2 py-0.5 rounded ml-2 uppercase font-black tracking-widest animate-pulse inline-block">Via Site</span>` 
            : '';

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
                    <p>💈 Barbeiro: <span class="text-gray-300">${data.barberName}</span></p>
                    <p>✂️ Serviço: <span class="text-gray-300">${data.service}</span></p>
                </div>
                <div class="text-sm">
                    <p class="font-black ${isDone ? 'text-green-500' : 'text-yellow-500'} uppercase tracking-widest">${data.status}</p>
                    <p class="font-bold text-white">R$ ${Number(data.price).toFixed(2)}</p>
                </div>
            </div>
            
            <div class="flex gap-2 w-full md:w-auto justify-end">
                ${!isDone && data.clientPhone ? `
                <a href="${whatsappUrl}" target="_blank" class="bg-[#25D366] hover:bg-[#1ebd5b] px-3 py-2 rounded text-white text-xs font-bold uppercase flex items-center gap-1 transition-all">
                    WPP
                </a>` : ''}
                
                ${!isDone ? `
                <button class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white px-4 py-2 rounded text-xs font-bold uppercase transition-all done-btn">
                    ✓ Confirmar
                </button>` : ''}
                
                <button class="bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white px-3 py-2 rounded text-xs font-bold uppercase transition-all del-btn">
                    ✕
                </button>
            </div>
        `;

        card.querySelector(".del-btn").addEventListener("click", async () => {
            if (confirm(`Deseja realmente CANCELAR o agendamento de ${data.clientName} às ${data.time}? O horário ficará livre novamente.`)) {
                await deleteDoc(doc(db, "barbershops", uid, "appointments", id));
                renderAppointments(uid, filterDate); 
            }
        });

        if (!isDone) {
            card.querySelector(".done-btn").addEventListener("click", async () => {
                if(confirm("Confirmar que o serviço foi finalizado? O valor irá para o faturamento.")){
                    await updateDoc(doc(db, "barbershops", uid, "appointments", id), { 
                        status: "concluido",
                        completedAt: serverTimestamp() 
                    });
                    renderAppointments(uid, filterDate); 
                }
            });
        }

        appointmentsList.appendChild(card);
    });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));