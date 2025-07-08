const map = L.map('map').setView([25.2048, 55.2708], 11); // Dubai center
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let heatLayer = null;
let transportMarkers = [];
let areaData = [];
let transportData = [];

function getColor(score) {
    // Green (affordable) to Red (unaffordable)
    const r = Math.floor(255 * (1 - score));
    const g = Math.floor(180 * score + 60 * (1 - score));
    return `rgb(${r},${g},80)`;
}

function clearHeatmap() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
}

function clearTransportMarkers() {
    transportMarkers.forEach(m => map.removeLayer(m));
    transportMarkers = [];
}

function haversine(lat1, lon1, lat2, lon2) {
    // Returns distance in km
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function minDistanceToTransport(area, stops) {
    let minDist = Infinity;
    stops.forEach(stop => {
        const d = haversine(area.latitude, area.longitude, stop.latitude, stop.longitude);
        if (d < minDist) minDist = d;
    });
    return minDist;
}

function filterAreas(areas, maxPrice, maxDist, stops) {
    return areas.filter(area => area.price <= maxPrice && minDistanceToTransport(area, stops) <= maxDist);
}

function updateTopAreasList(filteredAreas) {
    const topAreas = [...filteredAreas].sort((a, b) => b.score - a.score).slice(0, 3);
    const list = document.getElementById('top-areas-list');
    list.innerHTML = '';
    topAreas.forEach(area => {
        const li = document.createElement('li');
        li.textContent = `${area.name} (AED ${area.price.toLocaleString()}, Score: ${area.score})`;
        list.appendChild(li);
    });
}

function updateLeastAreasList(filteredAreas) {
    const leastAreas = [...filteredAreas].sort((a, b) => a.score - b.score).slice(0, 3);
    const list = document.getElementById('least-areas-list');
    list.innerHTML = '';
    leastAreas.forEach(area => {
        const li = document.createElement('li');
        li.textContent = `${area.name} (AED ${area.price.toLocaleString()}, Score: ${area.score})`;
        list.appendChild(li);
    });
}

function updateHeatmap(filteredAreas) {
    clearHeatmap();
    const points = filteredAreas.map(area => [area.latitude, area.longitude, area.score]);
    heatLayer = L.heatLayer(points, {
        radius: 40,
        blur: 30,
        minOpacity: 0.4,
        gradient: {0.0: 'red', 0.5: 'yellow', 1.0: 'lime'}
    }).addTo(map);
}

// --- UI/UX: Onboarding, Tooltips, Area Search, Amenities, Cost Calculator, Smart Suggest ---

// Area name search and amenities filter
function getSelectedAmenities() {
    return Array.from(document.querySelectorAll('#amenities-filter input[type=checkbox]:checked')).map(cb => cb.value);
}

document.getElementById('area-search').addEventListener('input', updateAnalyticsUI);
Array.from(document.querySelectorAll('#amenities-filter input[type=checkbox]')).forEach(cb => {
    cb.addEventListener('change', updateAnalyticsUI);
});

function getAdvancedFilters() {
    return {
        propertyType: document.getElementById('property-type-select').value,
        bedrooms: document.getElementById('bedrooms-select').value,
        furnished: document.getElementById('furnished-filter').checked,
        pet: document.getElementById('pet-filter').checked,
        newListing: document.getElementById('new-listing-filter').checked,
        family: document.getElementById('family-filter').checked
    };
}

function filterAreasAdvanced(areas, maxPrice, maxDist, stops, areaSearch, amenities, adv) {
    return areas.filter(area =>
        area.price <= maxPrice &&
        minDistanceToTransport(area, stops) <= maxDist &&
        (!areaSearch || area.name.toLowerCase().includes(areaSearch.toLowerCase())) &&
        amenities.every(am => area[am] === 1) &&
        (!adv.propertyType || area.property_type === adv.propertyType) &&
        (!adv.bedrooms || (adv.bedrooms === '5' ? area.bedrooms >= 5 : area.bedrooms == adv.bedrooms)) &&
        (!adv.furnished || area.furnished == 1) &&
        (!adv.pet || area.pet_friendly == 1) &&
        (!adv.newListing || area.new_listing == 1) &&
        (!adv.family || area.family_friendly == 1)
    );
}

// Override updateAnalyticsUI to use advanced filters
function updateAnalyticsUI() {
    const maxPrice = parseInt(document.getElementById('price-slider').value, 10);
    const maxDist = parseFloat(document.getElementById('proximity-slider').value);
    const areaSearch = document.getElementById('area-search').value;
    const amenities = getSelectedAmenities();
    const adv = getAdvancedFilters();
    document.getElementById('price-value').textContent = maxPrice.toLocaleString();
    document.getElementById('proximity-value').textContent = maxDist;
    const filteredAreas = filterAreasAdvanced(areaData, maxPrice, maxDist, transportData, areaSearch, amenities, adv);
    showPriceHeatmap(filteredAreas);
    updateTopAreasList(filteredAreas);
    updateLeastAreasList(filteredAreas);
    updateComparisonTable();
    clearSuggestionMarkers();
}

// Override fetchAndDisplayAffordability to use advanced filters
async function fetchAndDisplayAffordability() {
    const profession = document.getElementById('profession-select').value;
    const amenities = getSelectedAmenities();
    const areaSearch = document.getElementById('area-search').value;
    const adv = getAdvancedFilters();
    let url = `/api/affordability?profession="${encodeURIComponent(profession)}"`;
    if (amenities.length > 0) url += `&amenities=${amenities.join(',')}`;
    if (areaSearch) url += `&area=${encodeURIComponent(areaSearch)}`;
    // Advanced filters (property type, bedrooms, etc.)
    if (adv.propertyType) url += `&property_type=${adv.propertyType}`;
    if (adv.bedrooms) url += `&bedrooms=${adv.bedrooms}`;
    if (adv.furnished) url += `&furnished=1`;
    if (adv.pet) url += `&pet_friendly=1`;
    if (adv.newListing) url += `&new_listing=1`;
    if (adv.family) url += `&family_friendly=1`;
    const res = await fetch(url);
    const data = await res.json();
    areaData = data.areas;
    updateAnalyticsUI();
}

document.getElementById('area-search').addEventListener('input', fetchAndDisplayAffordability);
Array.from(document.querySelectorAll('#amenities-filter input[type=checkbox]')).forEach(cb => {
    cb.addEventListener('change', fetchAndDisplayAffordability);
});

// --- Help/Onboarding Modal ---
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelp = document.querySelector('.close-help');
helpBtn.onclick = function() { helpModal.style.display = 'block'; };
closeHelp.onclick = function() { helpModal.style.display = 'none'; };
window.addEventListener('click', function(event) {
    if (event.target === helpModal) helpModal.style.display = 'none';
});

// --- Cost Calculator Modal ---
const calcModal = document.getElementById('calculator-modal');
const closeCalc = document.querySelector('.close-calc');
const calcForm = document.getElementById('calculator-form');
const calcResults = document.getElementById('calc-results');
let openCalcBtn = null;
// Add a button to open calculator in analytics modal if not present
if (!document.getElementById('open-calc-btn')) {
    openCalcBtn = document.createElement('button');
    openCalcBtn.id = 'open-calc-btn';
    openCalcBtn.textContent = 'Open Cost Calculator';
    openCalcBtn.style.marginTop = '12px';
    document.getElementById('analytics-content').prepend(openCalcBtn);
    openCalcBtn.onclick = function() { calcModal.style.display = 'block'; calcResults.innerHTML = ''; };
}
closeCalc.onclick = function() { calcModal.style.display = 'none'; };
window.addEventListener('click', function(event) {
    if (event.target === calcModal) calcModal.style.display = 'none';
});
// --- Cost Calculator Modal: Show suggestions on map ---
calcForm.onsubmit = async function(e) {
    e.preventDefault();
    const income = document.getElementById('calc-income').value;
    const family = document.getElementById('calc-family').value;
    const proximity = document.getElementById('calc-proximity').value;
    const amenities = Array.from(document.querySelectorAll('input[name="calc-amenities"]:checked')).map(cb => cb.value);
    // Advanced filters
    const adv = getAdvancedFilters();
    const body = {
        income,
        family,
        amenities,
        proximity,
        property_type: adv.propertyType,
        bedrooms: adv.bedrooms,
        furnished: adv.furnished ? 1 : 0,
        pet_friendly: adv.pet ? 1 : 0,
        new_listing: adv.newListing ? 1 : 0,
        family_friendly: adv.family ? 1 : 0
    };
    const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.suggested.length === 0) {
        calcResults.innerHTML = '<p>No suitable areas found. Try adjusting your criteria.</p>';
        clearSuggestionMarkers();
    } else {
        calcResults.innerHTML = '<h3>Best Areas for You</h3>' +
            '<ul>' + data.suggested.map(a => `<li>${a.name} (AED ${a.price.toLocaleString()}, Score: ${a.score}, Proximity: ${a.proximity}km)</li>`).join('') + '</ul>';
        showSuggestionsOnMap(data.suggested);
    }
};

// --- Smart Suggest Button: Show suggestions on map ---
document.getElementById('smart-suggest-btn').onclick = async function() {
    const maxPrice = parseInt(document.getElementById('price-slider').value, 10);
    const maxDist = parseFloat(document.getElementById('proximity-slider').value);
    const amenities = getSelectedAmenities();
    const adv = getAdvancedFilters();
    const income = prompt('Enter your annual income (AED):', '120000');
    if (!income) return;
    const family = prompt('Enter your family size:', '1');
    if (!family) return;
    const body = {
        income,
        family,
        amenities,
        proximity: maxDist,
        property_type: adv.propertyType,
        bedrooms: adv.bedrooms,
        furnished: adv.furnished ? 1 : 0,
        pet_friendly: adv.pet ? 1 : 0,
        new_listing: adv.newListing ? 1 : 0,
        family_friendly: adv.family ? 1 : 0
    };
    const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.suggested.length === 0) {
        alert('No suitable areas found. Try adjusting your criteria.');
        clearSuggestionMarkers();
    } else {
        alert('AI Suggestion: ' + data.suggested.map(a => `${a.name} (AED ${a.price.toLocaleString()}, Score: ${a.score})`).join(', '));
        showSuggestionsOnMap(data.suggested);
    }
};

// --- Tooltips ---
function addTooltip(el, text) {
    el.setAttribute('title', text);
}
addTooltip(document.getElementById('profession-select'), 'Select your profession to see affordability.');
addTooltip(document.getElementById('analytics-btn'), 'Open advanced analytics and filters.');
addTooltip(document.getElementById('darkmode-toggle'), 'Toggle dark mode.');
addTooltip(document.getElementById('help-btn'), 'Show help and onboarding.');
addTooltip(document.getElementById('area-search'), 'Type to filter areas by name.');
addTooltip(document.getElementById('price-slider'), 'Adjust to set your maximum affordable price.');
addTooltip(document.getElementById('proximity-slider'), 'Set how close you want to be to public transport.');
addTooltip(document.getElementById('export-btn'), 'Export the current map as an image.');
addTooltip(document.getElementById('download-csv-btn'), 'Download filtered data as CSV.');
addTooltip(document.getElementById('smart-suggest-btn'), 'Let AI suggest the best areas for you!');

async function fetchAndDisplayTransport() {
    clearTransportMarkers();
    const res = await fetch('/api/transport');
    const data = await res.json();
    transportData = data.stops;
    data.stops.forEach(stop => {
        const marker = L.circleMarker([stop.latitude, stop.longitude], {
            radius: 8,
            color: '#0074D9',
            fillColor: '#0074D9',
            fillOpacity: 0.8,
            weight: 2
        }).addTo(map);
        marker.bindPopup(`<b>${stop.stop_name}</b>`);
        transportMarkers.push(marker);
    });
    updateAnalyticsUI();
}

document.getElementById('profession-select').addEventListener('change', () => {
    fetchAndDisplayAffordability();
});
document.getElementById('price-slider').addEventListener('input', updateAnalyticsUI);
document.getElementById('proximity-slider').addEventListener('input', updateAnalyticsUI);
document.getElementById('multi-profession').addEventListener('change', updateComparisonTable);

// Listen for advanced filter changes
['property-type-select','bedrooms-select','furnished-filter','pet-filter','new-listing-filter','family-filter'].forEach(id => {
    document.getElementById(id).addEventListener('change', fetchAndDisplayAffordability);
});

// Modal logic for analytics
const analyticsBtn = document.getElementById('analytics-btn');
const analyticsModal = document.getElementById('analytics-modal');
const closeModal = document.querySelector('.modal .close');

analyticsBtn.onclick = function() {
    analyticsModal.style.display = 'block';
    updateAnalyticsUI();
};
closeModal.onclick = function() {
    analyticsModal.style.display = 'none';
};
window.onclick = function(event) {
    if (event.target === analyticsModal) {
        analyticsModal.style.display = 'none';
    }
};

// Comparison Table Logic
async function updateComparisonTable() {
    const select = document.getElementById('multi-profession');
    const selected = Array.from(select.selectedOptions).map(opt => opt.value);
    const maxPrice = parseInt(document.getElementById('price-slider').value, 10);
    const maxDist = parseFloat(document.getElementById('proximity-slider').value);
    if (selected.length === 0) {
        document.getElementById('comparison-table-container').innerHTML = '';
        return;
    }
    // Fetch affordability for each selected profession
    const results = await Promise.all(selected.map(async prof => {
        const res = await fetch(`/api/affordability?profession="${encodeURIComponent(prof)}"`);
        const data = await res.json();
        return { profession: prof, areas: filterAreas(data.areas, maxPrice, maxDist, transportData) };
    }));
    // Build table
    let html = '<table style="width:100%;border-collapse:collapse;margin-top:16px;"><tr><th>Area</th>';
    results.forEach(r => { html += `<th>${r.profession}</th>`; });
    html += '</tr>';
    // Get all area names
    const areaNames = [...new Set(results.flatMap(r => r.areas.map(a => a.name)))];
    areaNames.forEach(areaName => {
        html += `<tr><td>${areaName}</td>`;
        results.forEach(r => {
            const area = r.areas.find(a => a.name === areaName);
            html += `<td>${area ? area.score : '-'}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';
    document.getElementById('comparison-table-container').innerHTML = html;
}

// Export Heatmap as Image
// Requires html2canvas (add via CDN)
if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    document.body.appendChild(script);
}
document.getElementById('export-btn').onclick = function() {
    if (!window.html2canvas) {
        alert('Please wait for export library to load.');
        return;
    }
    analyticsModal.style.display = 'none';
    setTimeout(() => {
        window.html2canvas(document.getElementById('map')).then(canvas => {
            const link = document.createElement('a');
            link.download = 'uae-affordability-heatmap.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }, 500);
};

document.getElementById('download-csv-btn').onclick = function() {
    const maxPrice = parseInt(document.getElementById('price-slider').value, 10);
    const maxDist = parseFloat(document.getElementById('proximity-slider').value);
    const filteredAreas = filterAreas(areaData, maxPrice, maxDist, transportData);
    let csv = 'Area,Latitude,Longitude,Price,Score\n';
    filteredAreas.forEach(area => {
        csv += `${area.name},${area.latitude},${area.longitude},${area.price},${area.score}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'uae-affordability-data.csv';
    link.click();
};

// Dark mode toggle
const darkToggle = document.getElementById('darkmode-toggle');
darkToggle.onclick = function() {
    document.body.classList.toggle('dark');
    if(document.body.classList.contains('dark')) {
        darkToggle.textContent = '☀️';
    } else {
        darkToggle.textContent = '🌙';
    }
};
// Set dark mode if preferred
if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    darkToggle.textContent = '☀️';
}

// --- Price Heatmap Logic ---
let priceHeatLayer = null;
let suggestionMarkers = [];

function clearPriceHeatmap() {
    if (priceHeatLayer) {
        map.removeLayer(priceHeatLayer);
        priceHeatLayer = null;
    }
}

function clearSuggestionMarkers() {
    suggestionMarkers.forEach(m => map.removeLayer(m));
    suggestionMarkers = [];
}

function getPriceColor(price, minPrice, maxPrice) {
    // Green (affordable) to Red (expensive)
    const t = (price - minPrice) / (maxPrice - minPrice);
    const r = Math.floor(255 * t);
    const g = Math.floor(200 * (1 - t) + 55 * t);
    return `rgb(${r},${g},80)`;
}

function showPriceHeatmap(areas) {
    clearPriceHeatmap();
    if (!areas.length) return;
    const prices = areas.map(a => a.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    // Use price as intensity for heatmap
    const points = areas.map(a => [a.latitude, a.longitude, 1 - (a.price - minPrice) / (maxPrice - minPrice + 1)]); // 1 = green, 0 = red
    priceHeatLayer = L.heatLayer(points, {
        radius: 40,
        blur: 30,
        minOpacity: 0.5,
        gradient: {0.0: 'lime', 0.5: 'yellow', 1.0: 'red'}
    }).addTo(map);
}

// --- Show AI Suggestions on Map ---
function showSuggestionsOnMap(suggestedAreas) {
    clearSuggestionMarkers();
    suggestedAreas.forEach(area => {
        const marker = L.marker([area.latitude, area.longitude], {
            icon: L.icon({
                iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon-2x.png',
                iconSize: [30, 48],
                iconAnchor: [15, 48],
                popupAnchor: [0, -40],
                className: 'suggestion-marker'
            })
        }).addTo(map);
        marker.bindPopup(`<b>Suggested: ${area.name}</b><br>Price: AED ${area.price.toLocaleString()}<br>Score: ${area.score}`);
        suggestionMarkers.push(marker);
    });
}

// Override updateAnalyticsUI to show price heatmap by default ---
function updateAnalyticsUI() {
    const maxPrice = parseInt(document.getElementById('price-slider').value, 10);
    const maxDist = parseFloat(document.getElementById('proximity-slider').value);
    const areaSearch = document.getElementById('area-search').value;
    const amenities = getSelectedAmenities();
    const adv = getAdvancedFilters();
    document.getElementById('price-value').textContent = maxPrice.toLocaleString();
    document.getElementById('proximity-value').textContent = maxDist;
    const filteredAreas = filterAreasAdvanced(areaData, maxPrice, maxDist, transportData, areaSearch, amenities, adv);
    showPriceHeatmap(filteredAreas);
    updateTopAreasList(filteredAreas);
    updateLeastAreasList(filteredAreas);
    updateComparisonTable();
    clearSuggestionMarkers();
}

// Initial load
fetchAndDisplayAffordability();
fetchAndDisplayTransport(); 