// CHANGE THIS TO YOUR LIVE RENDER/RAILWAY URL ONCE DEPLOYED
// Example: const BASE_URL = 'https://hydro-analytics-api.onrender.com';
const BASE_URL = 'http://localhost:3000'; 

let allStations = [];

window.onload = async () => {
    const loader = document.getElementById('loader-overlay');
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${BASE_URL}/api/all-stations`);
        allStations = await res.json();
        renderGrid(allStations.slice(0, 60));
    } catch (err) { console.error("Could not connect to API"); }
    finally { loader.classList.add('hidden'); }
};

function renderGrid(data) {
    const list = document.getElementById('station-list');
    list.innerHTML = data.map(s => `
        <div class="station-card" onclick="analyzeStation('${s.name}')">
            <h3>${s.name}</h3>
            <p>${s.district}</p>
        </div>
    `).join('');
}

async function analyzeStation(name) {
    const loader = document.getElementById('loader-overlay');
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${BASE_URL}/api/search?place=${encodeURIComponent(name.toLowerCase())}`);
        const data = await res.json();
        
        document.getElementById('prediction-output').classList.remove('hidden');
        document.getElementById('res-location').innerText = data.station;

        document.getElementById('res-level').innerHTML = `
            Live Estimate: <strong>${data.estimatedLevel}m</strong><br>
            1-Year Forecast: <strong>${data.forecastLevel}m</strong>
        `;

        document.getElementById('res-wpi').innerText = (data.wpi || 0) + "%";
        document.getElementById('res-hum').innerText = (data.humidity || 0) + "%";
        document.getElementById('res-temp').innerText = (data.temp || 0) + "°C";
        document.getElementById('res-suggest').innerText = data.recommendation;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert("Data Fetch Error"); }
    finally { loader.classList.add('hidden'); }
}

document.getElementById('search-bar').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStations.filter(s => 
        s.name.toLowerCase().includes(term) || s.district.toLowerCase().includes(term)
    );
    renderGrid(filtered.slice(0, 60));
});