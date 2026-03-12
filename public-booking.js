import { db } from "./firebase-config.js";
import { 
    collection, addDoc, getDocs, getDoc, doc, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get("id");
const form = document.getElementById("public-booking-form");
const barberSelect = document.getElementById("barber-select");
const serviceSelect = document.getElementById("booking-service");
const dateInput = document.getElementById("booking-date");
const timeGridContainer = document.getElementById("time-grid-container");
const timeGrid = document.getElementById("time-grid");
const successScreen = document.getElementById("success-screen");
const sound = document.getElementById("sound-scissors");
const btnWhatsapp = document.getElementById("btn-whatsapp");

let selectedTime = null;
let shopWhatsapp = "5511999999999"; 
let shopNameStr = "nossa barbearia";

const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

if (shopId) initPage();

async function initPage() {
    try {
        const shopSnap = await getDoc(doc(db, "barbershops", shopId));
        if (shopSnap.exists()) {
            const data = shopSnap.data();
            shopNameStr = data.name;
            document.getElementById("shop-name").innerText = shopNameStr;
            if (data.logoUrl) document.documentElement.style.setProperty('--bg-img', `url('${data.logoUrl}')`);
            if (data.phone) shopWhatsapp = data.phone.replace(/\D/g, ''); 
        }

        const barbersSnap = await getDocs(query(collection(db, "barbershops", shopId, "barbers"), orderBy("name", "asc")));
        barbersSnap.forEach(doc => {
            barberSelect.innerHTML += `<option value="${doc.id}" class="bg-black text-white">${doc.data().name}</option>`;
        });

        const servicesSnap = await getDocs(query(collection(db, "barbershops", shopId, "services"), orderBy("name", "asc")));
        servicesSnap.forEach(doc => {
            const s = doc.data();
            const descStr = s.description ? ` (${s.description})` : ''; // Mostra a descrição no seletor
            serviceSelect.innerHTML += `
                <option value="${s.name}" data-price="${s.price}" class="bg-black text-white">
                    ${s.name}${descStr} - R$ ${Number(s.price).toFixed(2)}
                </option>`;
        });

    } catch (e) { console.error("Erro ao inicializar página:", e); }
}

async function loadAvailableTimes() {
    const barberId = barberSelect.value;
    const dateVal = dateInput.value;

    if (!barberId || !dateVal) {
        timeGridContainer.classList.add("hidden");
        return; 
    }

    timeGridContainer.classList.remove("hidden");
    timeGrid.innerHTML = '<p class="text-[10px] text-accent col-span-4 text-center py-4">Buscando horários...</p>';
    selectedTime = null;

    try {
        const q = query(
            collection(db, "barbershops", shopId, "appointments"),
            where("barberId", "==", barberId),
            where("date", "==", dateVal)
        );
        const snaps = await getDocs(q);
        const occupiedTimes = snaps.docs.map(doc => doc.data().time);

        const allTimes = [
            "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
            "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", 
            "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
        ];

        const now = new Date();
        const currentDateStr = now.toLocaleDateString('en-CA'); 
        const isToday = dateVal === currentDateStr;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        timeGrid.innerHTML = "";
        let hasAvailable = false;

        allTimes.forEach(time => {
            const [h, m] = time.split(':').map(Number);
            const timeMinutes = h * 60 + m;

            const isPast = isToday && timeMinutes <= currentMinutes;
            const isOccupied = occupiedTimes.includes(time);

            if (!isPast && !isOccupied) {
                hasAvailable = true;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "time-btn";
                btn.innerText = time;
                btn.onclick = () => selectTimeSlot(btn, time);
                timeGrid.appendChild(btn);
            }
        });

        if (!hasAvailable) {
            timeGrid.innerHTML = '<p class="text-xs text-red-500 col-span-4 text-center py-4">Nenhum horário disponível hoje.</p>';
        }

    } catch (err) {
        console.error("Erro ao buscar horários", err);
        timeGrid.innerHTML = '<p class="text-xs text-red-500 col-span-4 text-center py-4">Erro ao carregar.</p>';
    }
}

function selectTimeSlot(btn, time) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTime = time;
}

barberSelect.addEventListener("change", loadAvailableTimes);
dateInput.addEventListener("change", loadAvailableTimes);

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-submit");
    const clientName = document.getElementById("client-name").value.toUpperCase();
    const serviceVal = serviceSelect.value;
    const dateVal = dateInput.value;
    
    if (!selectedTime) {
        alert("Por favor, selecione um horário na grade.");
        return;
    }

    const selectedServiceOption = serviceSelect.options[serviceSelect.selectedIndex];
    const price = selectedServiceOption.getAttribute("data-price");

    if (!price || !serviceVal) {
        alert("Por favor, selecione um serviço válido.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "PROCESSANDO...";

    try {
        const barberName = barberSelect.options[barberSelect.selectedIndex].text;
        const [ano, mes, dia] = dateVal.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;

        await addDoc(collection(db, "barbershops", shopId, "appointments"), {
            clientName: clientName,
            barberId: barberSelect.value,
            barberName: barberName,
            date: dateVal,
            time: selectedTime,
            service: serviceVal,
            price: Number(price),
            status: "pendente",
            createdAt: serverTimestamp(),
            viaPublic: true // O CLIENTE AGIU SOZINHO (Isso ativa a Tag lá no Dashboard)
        });

        const msgTexto = `Olá! Meu nome é *${clientName}*.\nFiz um agendamento pelo sistema para *${serviceVal}* com o *${barberName}*.\n📅 *Data:* ${dataFormatada}\n⏰ *Hora:* ${selectedTime}\nQuero confirmar meu horário!`;
        const linkWa = `https://api.whatsapp.com/send?phone=${shopWhatsapp}&text=${encodeURIComponent(msgTexto)}`;
        btnWhatsapp.href = linkWa;

        sound.play();
        confetti({ 
            particleCount: 150, spread: 80, origin: { y: 0.6 }, 
            colors: ['#D4AF37', '#ffffff', '#000000'] 
        });

        form.style.display = 'none'; 
        successScreen.style.display = 'flex';

    } catch (err) {
        console.error("Erro ao salvar agendamento:", err);
        btn.disabled = false;
        btn.innerText = "FINALIZAR RESERVA";
        alert("Erro ao realizar agendamento. Tente novamente.");
    }
});