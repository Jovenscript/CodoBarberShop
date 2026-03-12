import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let myChart;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Inicia o carregamento dos dados da barbearia
        await loadShopName(user.uid);
        await loadVisionaryDashboard(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

// Busca o nome da barbearia no Firebase e atualiza o menu lateral
async function loadShopName(uid) {
    try {
        const shopSnap = await getDoc(doc(db, "barbershops", uid));
        const shopNameElement = document.getElementById("shop-name-sidebar");
        
        if (shopSnap.exists() && shopSnap.data().name) {
            shopNameElement.innerText = shopSnap.data().name;
        } else {
            shopNameElement.innerText = "BarberFlow"; // Fallback caso não tenha nome cadastrado
        }
    } catch (error) {
        console.error("Erro ao buscar nome da barbearia:", error);
        document.getElementById("shop-name-sidebar").innerText = "BarberFlow";
    }
}

async function loadVisionaryDashboard(uid) {
    // 1. Criar a lista dos últimos 7 dias para o gráfico (Eixo X)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }

    try {
        // 2. Busca Agendamentos Concluídos (Independente da data para o Total Revenue)
        const qAppo = query(
            collection(db, "barbershops", uid, "appointments"),
            where("status", "==", "concluido")
        );

        // 3. Busca Clientes e Barbeiros simultaneamente para performance
        const [appoSnap, clientsSnap, barbersSnap] = await Promise.all([
            getDocs(qAppo),
            getDocs(collection(db, "barbershops", uid, "clients")),
            getDocs(collection(db, "barbershops", uid, "barbers"))
        ]);

        let totalRevenue = 0;
        const dailyData = {};
        last7Days.forEach(day => dailyData[day] = 0);

        // 4. Lógica de Soma: O "Cérebro" do Financeiro
        appoSnap.forEach(doc => {
            const data = doc.data();
            // Garante que o preço seja tratado como número
            const valor = parseFloat(data.price) || 0;
            
            // Soma no faturamento total acumulado (Esse valor aparece no card lá em cima)
            totalRevenue += valor;
            
            // Se o agendamento for de um dos últimos 7 dias, soma no gráfico
            if (dailyData[data.date] !== undefined) {
                dailyData[data.date] += valor;
            }
        });

        // 5. Atualiza os Cards na Interface
        document.getElementById("total-revenue").innerText = `R$ ${totalRevenue.toFixed(2)}`;
        document.getElementById("total-clients").innerText = clientsSnap.size;
        document.getElementById("total-barbers").innerText = barbersSnap.size;
        document.getElementById("total-completed").innerText = appoSnap.size;

        // 6. Renderiza o Gráfico com as cores BarberFlow
        renderChart(Object.keys(dailyData), Object.values(dailyData));

    } catch (error) {
        console.error("Erro na automação do Dashboard:", error);
    }
}

function renderChart(labels, data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => l.split('-').reverse().slice(0,2).join('/')), 
            datasets: [{
                label: 'Faturamento R$',
                data: data,
                borderColor: '#D4AF37', 
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#D4AF37'
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
                    ticks: { color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
}

// Botão de Logout
const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));

// ==========================================
// SISTEMA DE NOTIFICAÇÕES (MEIO-DIA) E WHATSAPP
// ==========================================

const notificationBtn = document.getElementById("notification-btn");
const notificationPanel = document.getElementById("notification-panel");
const notificationBadge = document.getElementById("notification-badge");
const whatsappList = document.getElementById("whatsapp-list");

// O Som de notificação (Um "Ding" suave)
const somNotificacao = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Mostra/Esconde o painel ao clicar no sino
notificationBtn.addEventListener("click", () => {
    notificationPanel.classList.toggle("hidden");
    notificationBadge.classList.add("hidden"); // Esconde a bolinha vermelha ao abrir
});

// Função que busca os clientes de amanhã e gera os links
async function gerarConfirmacoesWhatsApp() {
    try {
        // Pega a data de amanhã no formato YYYY-MM-DD
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dataAmanhaStr = amanha.toISOString().split('T')[0];

        // Se você tiver múltiplos barbeiros/lojas, ajuste essa query para a sua estrutura do Firebase
        // Aqui estou supondo que os agendamentos estão na raiz ou dentro da sua barbershop
        const { collection, query, where, getDocs, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        // ** ATENÇÃO: Ajuste "currentShopId" conforme o seu código no topo do dashboard.js **
        const q = query(
            collection(db, "barbershops", currentShopId, "appointments"), 
            where("date", "==", dataAmanhaStr),
            where("status", "!=", "concluido") // Não puxa os concluídos/cancelados
        );

        const snapshot = await getDocs(q);
        
        whatsappList.innerHTML = "";

        if (snapshot.empty) {
            whatsappList.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhum agendamento para amanhã.</p>`;
            return;
        }

        let temCliente = false;

        snapshot.forEach((doc) => {
            const appo = doc.data();
            // Precisamos que o agendamento tenha salvo o telefone do cliente! 
            // Caso não tenha salvo direto no agendamento, você teria que fazer outro getDoc na coleção de clientes.
            // Para simplificar, supondo que tenha appo.clientPhone (se não tiver, coloque "Sem telefone").
            const telefone = appo.clientPhone || "5500000000000"; 
            const nomeCliente = appo.clientName || "Cliente";
            const horario = appo.time;
            const servico = appo.service;

            // Formata o número (Tira espaços, traços e parênteses)
            const numeroLimpo = telefone.replace(/\D/g, '');
            // Verifica se tem o 55 do Brasil, se não, adiciona
            const numeroZap = numeroLimpo.startsWith("55") ? numeroLimpo : "55" + numeroLimpo;

            // A Mensagem Pronta
            const textoMsg = `Olá, ${nomeCliente}! Tudo bem? Passando aqui para confirmar o seu horário de amanhã às ${horario} para o serviço de ${servico}. Podemos confirmar? ✂️`;
            const linkZap = `https://wa.me/${numeroZap}?text=${encodeURIComponent(textoMsg)}`;

            temCliente = true;

            whatsappList.innerHTML += `
                <div class="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                    <div>
                        <p class="font-bold text-white text-sm">${nomeCliente}</p>
                        <p class="text-xs text-gray-400">Amanhã, ${horario}</p>
                    </div>
                    <a href="${linkZap}" target="_blank" class="bg-green-600 hover:bg-green-500 text-white p-2 rounded-full transition" title="Enviar WhatsApp">
                        <i data-lucide="phone" class="w-4 h-4"></i>
                    </a>
                </div>
            `;
        });

        // Recria os ícones Lucide recém injetados
        if(window.lucide) window.lucide.createIcons();

        // Se encontrou clientes, toca o som e mostra a bolinha
        if (temCliente) {
            somNotificacao.play().catch(e => console.log("O navegador bloqueou o som automático. Clique na tela antes."));
            notificationBadge.classList.remove("hidden");
            // Se o painel estiver fechado, dá um aviso
            if(notificationPanel.classList.contains("hidden")){
                // Você pode usar um alert ou só deixar a bolinha lá
            }
        }

    } catch (error) {
        console.error("Erro ao puxar lista do zap:", error);
    }
}

// O Verificador do Relógio (Roda a cada 1 minuto)
setInterval(() => {
    const agora = new Date();
    
    // Verifica se é 12:00 (Meio-dia)
    if (agora.getHours() === 12 && agora.getMinutes() === 0) {
        
        // Evita que apite várias vezes no mesmo dia usando o localStorage do navegador
        const ultimaNotificacao = localStorage.getItem('ultimaNotificacaoZap');
        const hojeStr = agora.toDateString();

        if (ultimaNotificacao !== hojeStr) {
            gerarConfirmacoesWhatsApp();
            localStorage.setItem('ultimaNotificacaoZap', hojeStr);
        }
    }
}, 60000); // 60000 milissegundos = 1 minuto

// Dica: Para TESTAR AGORA sem esperar o meio-dia, descomente a linha abaixo e salve. Ele vai apitar e gerar a lista na hora que atualizar a página.
 setTimeout(gerarConfirmacoesWhatsApp, 2000);

