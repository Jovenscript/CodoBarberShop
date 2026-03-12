import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const totalRevenueEl = document.getElementById("total-revenue");
const totalClientsEl = document.getElementById("total-clients");
const totalBarbersEl = document.getElementById("total-barbers");
const totalCompletedEl = document.getElementById("total-completed");

let revenueChartInstance = null;
let currentShopId = null; // Guardando o ID da loja para usar no sininho

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    const userId = user.uid;
    currentShopId = userId; // Salva o ID globalmente

    loadShopName(userId);
    loadDashboardData(userId);
    
    // Inicia o sistema de notificações após carregar os dados
    iniciarSistemaNotificacoes();
});

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

async function loadDashboardData(uid) {
    try {
        const clientsSnap = await getDocs(collection(db, "barbershops", uid, "clients"));
        totalClientsEl.innerText = clientsSnap.size;

        const barbersSnap = await getDocs(collection(db, "barbershops", uid, "barbers"));
        totalBarbersEl.innerText = barbersSnap.size;

        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6); 

        const appointmentsSnap = await getDocs(collection(db, "barbershops", uid, "appointments"));
        
        let totalRev = 0;
        let completedCount = 0;
        let revenueByDay = {
            [formatDate(sevenDaysAgo)]: 0,
            [formatDate(addDays(sevenDaysAgo, 1))]: 0,
            [formatDate(addDays(sevenDaysAgo, 2))]: 0,
            [formatDate(addDays(sevenDaysAgo, 3))]: 0,
            [formatDate(addDays(sevenDaysAgo, 4))]: 0,
            [formatDate(addDays(sevenDaysAgo, 5))]: 0,
            [formatDate(today)]: 0
        };

        appointmentsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.status === "concluido" && data.date) {
                completedCount++;
                if (revenueByDay[data.date] !== undefined) {
                    revenueByDay[data.date] += Number(data.price);
                    totalRev += Number(data.price);
                }
            }
        });

        totalCompletedEl.innerText = completedCount;
        totalRevenueEl.innerText = `R$ ${totalRev.toFixed(2)}`;

        const labels = Object.keys(revenueByDay).map(d => d.split('-').reverse().slice(0, 2).join('/')); 
        const values = Object.values(revenueByDay);

        renderChart(labels, values);

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function renderChart(labels, data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento Diário (R$)',
                data: data,
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#D4AF37',
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9CA3AF' }
                }
            }
        }
    });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));


// ==========================================
// SISTEMA DE NOTIFICAÇÕES (MEIO-DIA) E WHATSAPP
// ==========================================

function iniciarSistemaNotificacoes() {
    const notificationBtn = document.getElementById("notification-btn");
    const notificationPanel = document.getElementById("notification-panel");
    const notificationBadge = document.getElementById("notification-badge");
    const whatsappList = document.getElementById("whatsapp-list");

    if(!notificationBtn) return; // Se não estiver na página certa, não faz nada

    // O Som de notificação
    const somNotificacao = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    // Mostra/Esconde o painel ao clicar no sino
    notificationBtn.addEventListener("click", () => {
        notificationPanel.classList.toggle("hidden");
        notificationBadge.classList.add("hidden"); 
    });

    async function gerarConfirmacoesWhatsApp() {
        try {
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const dataAmanhaStr = amanha.toISOString().split('T')[0];

            const q = query(
                collection(db, "barbershops", currentShopId, "appointments"), 
                where("date", "==", dataAmanhaStr),
                where("status", "!=", "concluido") 
            );

            const snapshot = await getDocs(q);
            whatsappList.innerHTML = "";

            if (snapshot.empty) {
                whatsappList.innerHTML = `<p class="text-sm text-gray-500 italic px-2">Nenhum agendamento para amanhã.</p>`;
                return;
            }

            let temCliente = false;

            snapshot.forEach((doc) => {
                const appo = doc.data();
                const telefone = appo.clientPhone || "5500000000000"; 
                const nomeCliente = appo.clientName || "Cliente";
                const horario = appo.time;
                const servico = appo.service;

                const numeroLimpo = telefone.replace(/\D/g, '');
                const numeroZap = numeroLimpo.startsWith("55") ? numeroLimpo : "55" + numeroLimpo;

                const textoMsg = `Olá, ${nomeCliente}! Tudo bem? Passando aqui para confirmar o seu horário de amanhã às ${horario} para o serviço de ${servico}. Podemos confirmar? ✂️`;
                const linkZap = `https://wa.me/${numeroZap}?text=${encodeURIComponent(textoMsg)}`;

                temCliente = true;

                whatsappList.innerHTML += `
                    <div class="bg-gray-700 p-3 rounded-lg flex justify-between items-center hover:bg-gray-600 transition">
                        <div>
                            <p class="font-bold text-white text-sm">${nomeCliente}</p>
                            <p class="text-[10px] text-accent uppercase font-bold tracking-widest mt-1">Amanhã, ${horario}</p>
                        </div>
                        <a href="${linkZap}" target="_blank" class="bg-[#25D366] hover:bg-[#1ebd5b] text-white p-2 rounded-full transition shadow-lg shadow-green-900/50" title="Enviar WhatsApp">
                            <i data-lucide="phone" class="w-4 h-4"></i>
                        </a>
                    </div>
                `;
            });

            if(window.lucide) window.lucide.createIcons();

            if (temCliente) {
                somNotificacao.play().catch(e => console.log("Som bloqueado pelo navegador."));
                notificationBadge.classList.remove("hidden");
            }

        } catch (error) {
            console.error("Erro ao puxar lista do zap:", error);
        }
    }

    // --- TESTE RÁPIDO: Tira as duas barras (//) do comando abaixo para testar AGORA:
    setTimeout(gerarConfirmacoesWhatsApp, 2000);

    // O Verificador do Relógio (Roda a cada 1 minuto)
    setInterval(() => {
        const agora = new Date();
        if (agora.getHours() === 12 && agora.getMinutes() === 0) {
            const ultimaNotificacao = localStorage.getItem('ultimaNotificacaoZap');
            const hojeStr = agora.toDateString();

            if (ultimaNotificacao !== hojeStr) {
                gerarConfirmacoesWhatsApp();
                localStorage.setItem('ultimaNotificacaoZap', hojeStr);
            }
        }
    }, 60000);
}

