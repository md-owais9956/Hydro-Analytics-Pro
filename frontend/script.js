// MUST BE YOUR LIVE RENDER URL (No trailing slash)
const BASE_URL = 'https://hydro-analytics-pro.onrender.com'; 

let allStations = [];

window.onload = async () => {
    const loader = document.getElementById('loader-overlay');
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${BASE_URL}/api/all-stations`);
        if (!res.ok) throw new Error("Waking up...");
        allStations = await res.json();
        renderGrid(allStations.slice(0, 60));
    } catch (err) {
        console.log("Server is warming up, retrying in 2 seconds...");
        setTimeout(window.onload, 2000); // Auto-retry the initial load
    } finally {
        loader.classList.add('hidden');
    }
};

async function analyzeStation(name) {
    const loader = document.getElementById('loader-overlay');
    const output = document.getElementById('prediction-output');
    
    loader.classList.remove('hidden');
    output.classList.add('hidden'); // Hide old results while loading

    try {
        const res = await fetch(`${BASE_URL}/api/search?place=${encodeURIComponent(name.toLowerCase())}`);
        
        if (!res.ok) throw new Error("API Delay");

        const data = await res.json();
        
        // Populate UI
        document.getElementById('res-location').innerText = data.station;
        document.getElementById('res-level').innerHTML = `
            Live Estimate: <strong>${data.estimatedLevel}m</strong><br>
            1-Year Forecast: <strong>${data.forecastLevel}m</strong>
        `;
        document.getElementById('res-wpi').innerText = data.wpi + "%";
        document.getElementById('res-hum').innerText = data.humidity + "%";
        document.getElementById('res-temp').innerText = data.temp + "°C";
        document.getElementById('res-suggest').innerText = data.recommendation;

        output.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.warn("Retrying analysis due to server latency...");
        // Instead of an alert, we wait 1 second and try again automatically
        setTimeout(() => analyzeStation(name), 1000);
    } finally {
        loader.classList.add('hidden');
    }
}

// Search Filter Logic
document.getElementById('search-bar').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStations.filter(s => 
        s.name.toLowerCase().includes(term) || s.district.toLowerCase().includes(term)
    );
    renderGrid(filtered.slice(0, 60));
});

function renderGrid(data) {
    const list = document.getElementById('station-list');
    list.innerHTML = data.map(s => `
        <div class="station-card" onclick="analyzeStation('${s.name}')">
            <h3>${s.name}</h3>
            <p>${s.district}</p>
        </div>
    `).join('');
}