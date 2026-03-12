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