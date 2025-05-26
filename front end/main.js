// Global variables
let map;
let popup;
let currentMarker;
let cityMarkers = {};
let useMetric = true;
let forecastChart;
let tempChart;
let rainChart;
let annualPatternChart;
let extremesChart;
let monthlyRainChart;
let trendChart;
let temperatureLayer;
let rainfallLayer;
let currentLayer = 'temperature';

// Weather code to icon mapping
const weatherIcons = {
    0: 'https://openweathermap.org/img/wn/01d@2x.png', // Clear sky
    1: 'https://openweathermap.org/img/wn/02d@2x.png', // Mainly clear
    2: 'https://openweathermap.org/img/wn/03d@2x.png', // Partly cloudy
    3: 'https://openweathermap.org/img/wn/04d@2x.png', // Overcast
    45: 'https://openweathermap.org/img/wn/50d@2x.png', // Foggy
    48: 'https://openweathermap.org/img/wn/50d@2x.png', // Depositing rime fog
    51: 'https://openweathermap.org/img/wn/09d@2x.png', // Light drizzle
    53: 'https://openweathermap.org/img/wn/09d@2x.png', // Moderate drizzle
    55: 'https://openweathermap.org/img/wn/09d@2x.png', // Dense drizzle
    61: 'https://openweathermap.org/img/wn/10d@2x.png', // Slight rain
    63: 'https://openweathermap.org/img/wn/10d@2x.png', // Moderate rain
    65: 'https://openweathermap.org/img/wn/10d@2x.png', // Heavy rain
    71: 'https://openweathermap.org/img/wn/13d@2x.png', // Slight snow
    73: 'https://openweathermap.org/img/wn/13d@2x.png', // Moderate snow
    75: 'https://openweathermap.org/img/wn/13d@2x.png', // Heavy snow
    77: 'https://openweathermap.org/img/wn/13d@2x.png', // Snow grains
    80: 'https://openweathermap.org/img/wn/09d@2x.png', // Slight rain showers
    81: 'https://openweathermap.org/img/wn/09d@2x.png', // Moderate rain showers
    82: 'https://openweathermap.org/img/wn/09d@2x.png', // Violent rain showers
    85: 'https://openweathermap.org/img/wn/13d@2x.png', // Slight snow showers
    86: 'https://openweathermap.org/img/wn/13d@2x.png', // Heavy snow showers
    95: 'https://openweathermap.org/img/wn/11d@2x.png', // Thunderstorm
    96: 'https://openweathermap.org/img/wn/11d@2x.png', // Thunderstorm with slight hail
    99: 'https://openweathermap.org/img/wn/11d@2x.png'  // Thunderstorm with heavy hail
};

// Function to get color based on temperature
function getTemperatureColor(temp) {
return temp > 35 ? '#800026' :  // Dark red
            temp > 30 ? '#E31A1C' :  // Bright red
            temp > 25 ? '#FD8D3C' :  // Orange
            temp > 20 ? '#FEB24C' :  // Light orange
            temp > 15 ? '#FED976' :  // Yellow
            temp > 10 ? '#BFDBF7' :  // Light blue
            temp > 5  ? '#6BAED6' :  // Medium blue
                    '#08519C';    // Dark blue  
                    }

// Function to get color based on rainfall
function getRainfallColor(rain) {
    if (rain <= 1) return '#E3F2FD';  // Very light blue
    if (rain <= 2) return '#90CAF9';  // Light blue
    if (rain <= 5) return '#2196F3';  // Medium blue
    if (rain <= 10) return '#1976D2'; // Dark blue
    return '#0D47A1';                 // Very dark blue
}

function initializeMap() {
// Initialize map centered on Australia
    map = L.map('map').setView([-27, 133], 4);
    
    // Add the base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add layer control buttons
    const layerControl = L.control({ position: 'topright' });
    layerControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'layer-control');
        div.innerHTML = `
                    <div class="bg-white p-2 rounded shadow">
        <button id="tempLayer" class="px-3 py-1 bg-blue-500 text-white rounded mr-2">Temperature</button>
        <button id="rainLayer" class="px-3 py-1 bg-green-500 text-white rounded">Rainfall</button>
        </div>
        `;
        
    // Add click event listeners
    div.querySelector('#tempLayer').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        switchLayer('temperature');
    });
    
    div.querySelector('#rainLayer').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        switchLayer('rainfall');
    });

        return div;
    };
    layerControl.addTo(map);

    // Initialize markers for all cities
    Object.entries(cities_2).forEach(([city, [lat, lon]]) => {
    updateCityWeatherIcon(city, lat, lon);
    });

    // Load GeoJSON data and initialize the temperature layer
    fetch('./australia_states.geojson')
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('GeoJSON data loaded successfully');
        window.australianStates = data;
        updateChoroplethMap('temperature');
    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
        alert('Error loading map data. Please try again later.');
    });
}

async function updateChoroplethMap(layerType) {
    if (!window.australianStates) {
    console.error('GeoJSON data not loaded yet');
    return;
    }
    
    currentLayer = layerType;
    console.log('Updating choropleth map for:', layerType);
    
    // Remove existing layers and legend if they exist
    if (temperatureLayer) map.removeLayer(temperatureLayer);
    if (rainfallLayer) map.removeLayer(rainfallLayer);
    if (window.currentLegend) map.removeControl(window.currentLegend);

    try {
    // Fetch current weather data for all capitals
    const weatherData = {};
    await Promise.all(Object.entries(cities_2).map(async ([city, [lat, lon]]) => {
        try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=precipitation_sum&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        weatherData[city] = {
            temperature: data.current_weather.temperature,
            rainfall: data.daily.precipitation_sum[0] || 0
        };
        } catch (error) {
        console.error(`Error fetching data for ${city}:`, error);
        }
    }));

    // Create the choropleth layer
    const layer = L.geoJSON(window.australianStates, {
    style: function(feature) {
        const stateName = feature.properties.STATE_NAME.toLowerCase();
        let capitalCity;
        
        // Map state names to capital cities
        switch(stateName) {
        case 'victoria': capitalCity = 'melbourne'; break;
        case 'new south wales': capitalCity = 'sydney'; break;
        case 'queensland': capitalCity = 'brisbane'; break;
        case 'western australia': capitalCity = 'perth'; break;
        case 'south australia': capitalCity = 'adelaide'; break;
        case 'tasmania': capitalCity = 'hobart'; break;
        case 'northern territory': capitalCity = 'darwin'; break;
        case 'australian capital territory': capitalCity = 'canberra'; break;
        default: capitalCity = null;
        }

        const data = weatherData[capitalCity];
        if (!data) {
        return {
            fillColor: '#cccccc',
            color: '#666',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        };
        }

const value = layerType === 'temperature' ? data.temperature : data.rainfall;
        const color = layerType === 'temperature' ? 
        getTemperatureColor(value) : 
        getRainfallColor(value);

        return {
        fillColor: color,
        color: '#ffffff',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.8
        };
    },
        onEachFeature: function(feature, layer) {
        const stateName = feature.properties.STATE_NAME;
        const capitalName = stateName.toLowerCase();
        let capitalCity;
        
        switch(capitalName) {
            case 'victoria': capitalCity = 'melbourne'; break;
            case 'new south wales': capitalCity = 'sydney'; break;
            case 'queensland': capitalCity = 'brisbane'; break;
            case 'western australia': capitalCity = 'perth'; break;
            case 'south australia': capitalCity = 'adelaide'; break;
            case 'tasmania': capitalCity = 'hobart'; break;
            case 'northern territory': capitalCity = 'darwin'; break;
            case 'australian capital territory': capitalCity = 'canberra'; break;
            default: capitalCity = null;
        }
        
        const data = weatherData[capitalCity];
        
        if (data) {
            const displayValue = layerType === 'temperature' ? 
            formatTemperature(data.temperature) :
            `${data.rainfall.toFixed(1)} mm`;

            // Create tooltip content
            const tooltipContent = `
            <div style="font-size: 14px; line-height: 1.5;">
                <strong>${stateName}</strong><br>
                Capital: ${capitalCity.charAt(0).toUpperCase() + capitalCity.slice(1)}<br>
                ${layerType.charAt(0).toUpperCase() + layerType.slice(1)}: ${displayValue}
            </div>
            `;

            // Add both popup and tooltip
            layer.bindPopup(tooltipContent);
            layer.bindTooltip(tooltipContent, {
            direction: 'center',
            permanent: false,
            sticky: true,
            opacity: 0.9,
            className: 'custom-tooltip'
            });
        }
        }
    }).addTo(map);

    // Store the layer reference
    if (layerType === 'temperature') {
        temperatureLayer = layer;
    } else {
    rainfallLayer = layer;
    }

// Create and add the legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'legend');
                div.style.backgroundColor = 'white';
        div.style.padding = '0';
        div.style.margin = '0';
        div.style.borderRadius = '4px';
        div.style.border = '1px solid rgba(0,0,0,0.2)';
        div.style.fontSize = '11px';
        div.style.lineHeight = '16px';
        div.style.maxWidth = '160px';
        div.style.maxHeight = '300px';
        div.style.overflowY = 'auto';
        div.style.marginBottom = '30px';
        div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

        let grades, title;
        if (layerType === 'temperature') {
        title = 'Temperature';
        grades = [
            { min: 35, max: null, color: '#800026', label: '> 35°C', desc: 'Very Hot' },
            { min: 30, max: 35, color: '#E31A1C', label: '30-35°C', desc: 'Hot' },
            { min: 25, max: 30, color: '#FD8D3C', label: '25-30°C', desc: 'Warm' },
            { min: 20, max: 25, color: '#FEB24C', label: '20-25°C', desc: 'Mild' },
            { min: 15, max: 20, color: '#FED976', label: '15-20°C', desc: 'Cool' },
            { min: 10, max: 15, color: '#BFDBF7', label: '10-15°C', desc: 'Cold' },
            { min: 5, max: 10, color: '#6BAED6', label: '5-10°C', desc: 'Very Cold' },
            { min: null, max: 5, color: '#08519C', label: '< 5°C', desc: 'Freezing' }
        ];
        } else {
        title = 'Rainfall';
        grades = [
            { min: 10, max: null, color: '#0D47A1', label: '> 10mm', desc: 'Heavy Rain' },
            { min: 5, max: 10, color: '#1976D2', label: '5-10mm', desc: 'Moderate Rain' },
            { min: 2, max: 5, color: '#2196F3', label: '2-5mm', desc: 'Light Rain' },
            { min: 1, max: 2, color: '#90CAF9', label: '1-2mm', desc: 'Very Light Rain' },
            { min: 0, max: 1, color: '#E3F2FD', label: '0-1mm', desc: 'Minimal Rain' }
        ];
        }

        div.innerHTML = `
        <div style="background-color: ${layerType === 'temperature' ? '#E31A1C' : '#1976D2'}; color: white; padding: 4px; border-top-left-radius: 3px; border-top-right-radius: 3px; font-weight: bold; font-size: 11px; text-align: center;">
            ${layerType === 'temperature' ? 'Temperature Legend' : 'Rainfall Legend'}
        </div>
        <div style="padding: 4px;">
            ${grades.map(grade => `
            <div style="display: flex; align-items: center; margin-bottom: 0px;">
                <i style="
                background: ${grade.color}; 
                display: inline-block; 
                width: 16px; 
                height: 16px; 
                margin-right: 4px; 
                opacity: 0.9;
                border: 1px solid rgba(0,0,0,0.2);
                border-radius: 2px;
                "></i>
                <span style="flex-grow: 1;">
                <strong style="font-size: 10px;">${grade.label}</strong>
                <span style="color: #666; font-size: 9px; margin-left: 4px;">${grade.desc}</span>
                </span>
                </div>
            `).join('')}
        </div>
        `;

    return div;
    };

    // Store the legend reference and add it to the map
    window.currentLegend = legend;
    legend.addTo(map);

    // Update weather icons after choropleth is created
    Object.entries(cities_2).forEach(([city, [lat, lon]]) => {
        updateCityWeatherIcon(city, lat, lon);
    });

    } catch (error) {
    console.error('Error updating choropleth map:', error);
    }
}

function switchLayer(layerType) {
    if (currentLayer !== layerType) {
    updateChoroplethMap(layerType);
    }
}

// Function to create weather icon
function createWeatherIcon(iconUrl, weatherCode) {
    return L.divIcon({
    html: `<img src="${iconUrl}" style="width: 30px; height: 30px;">`,
    className: 'weather-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
    });
}

// Define cities
const cities = {
    melbourne: [-37.8136, 144.9631],
    sydney: [-33.8688, 151.2093],
    brisbane: [-27.4698, 153.0251],
    perth: [-31.9505, 115.8605],
    adelaide: [-34.9285, 138.6007],
    canberra: [-35.2809, 149.1300]

};

const cities_2 = {
    melbourne: [-37.8136, 144.9631],
    sydney: [-33.8688, 151.2093],
    brisbane: [-27.4698, 153.0251],
    perth: [-31.9505, 115.8605],
    adelaide: [-34.9285, 138.6007],
    hobart: [-42.8821, 147.3272],
    darwin: [-12.4634, 130.9277],
    canberra: [-35.2809, 149.1300]

};

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeCharts();
    
    // Set up initial data
    const defaultCity = 'melbourne';
    const [lat, lon] = cities[defaultCity];
    loadCurrentWeather(lat, lon);
    
    // Load initial past weather data
    const currentYear = new Date().getFullYear() -1;
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    loadPastWeatherCompare('melbourne', 'sydney', currentYear, currentMonth);

    // Initialize year selectors with proper range
    const trendStartYear = document.getElementById('trendStartYear');
    const trendEndYear = document.getElementById('trendEndYear');
    const annualYearSelect = document.getElementById('annualYearSelect');

    // Clear existing options
    trendStartYear.innerHTML = '';
    trendEndYear.innerHTML = '';
    annualYearSelect.innerHTML = '';

    // Add options for the last 20 years, excluding future years
    for (let year = currentYear; year >= currentYear - 19; year--) {
    const opt1 = document.createElement('option');
    const opt2 = document.createElement('option');
    const opt3 = document.createElement('option');
    
    opt1.value = opt1.textContent = year;
    opt2.value = opt2.textContent = year;
    opt3.value = opt3.textContent = year;
    
    trendStartYear.appendChild(opt1);
    trendEndYear.appendChild(opt2);
    annualYearSelect.appendChild(opt3);
    }

    // Set default selections
    trendStartYear.value = currentYear - 19;
    trendEndYear.value = currentYear;
    annualYearSelect.value = currentYear;

    // Initialize the new charts with data
    updateAnnualPattern();
    updateExtremesAndRainfall();
    updateTrendAnalysis();

    // Add event listeners for the new selectors
    document.getElementById('annualCitySelect').addEventListener('change', () => {
    updateAnnualPattern();
    updateExtremesAndRainfall();
    });
    document.getElementById('annualYearSelect').addEventListener('change', () => {
    updateAnnualPattern();
    updateExtremesAndRainfall();
    });
    document.getElementById('trendCitySelect').addEventListener('change', updateTrendAnalysis);
    document.getElementById('trendStartYear').addEventListener('change', updateTrendAnalysis);
    document.getElementById('trendEndYear').addEventListener('change', updateTrendAnalysis);

    // Update city select options
    const citySelects = [
    'currentCitySelect',
    'pastCitySelectA',
    'pastCitySelectB',
    'annualCitySelect',
    'trendCitySelect'
    ];

    citySelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
        select.innerHTML = ''; // Clear existing options
        Object.keys(cities).forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city.charAt(0).toUpperCase() + city.slice(1);
        select.appendChild(option);
        });
    }
    });

    // Set default selections
    document.getElementById('currentCitySelect').value = 'melbourne';
    document.getElementById('pastCitySelectA').value = 'melbourne';
    document.getElementById('pastCitySelectB').value = 'sydney';
    document.getElementById('annualCitySelect').value = 'melbourne';
    document.getElementById('trendCitySelect').value = 'melbourne';

    updateForecastChart(); // Add this line to initialize the forecast chart
});

function initializeCharts() {
    // Initialize forecast chart
    const forecastCtx = document.getElementById('forecastChart').getContext('2d');
    forecastChart = new Chart(forecastCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
        {
            label: 'City A Max',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgb(255, 99, 132)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointStyle: 'circle'
        },
        {
            label: 'City A Min',
            data: [],
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgb(255, 159, 64)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointStyle: 'circle'
        },
        {
            label: 'City B Max',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgb(75, 192, 192)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointStyle: 'circle'
        },
        {
            label: 'City B Min',
            data: [],
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgb(54, 162, 235)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointStyle: 'circle'
        }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
        intersect: false,
        mode: 'index'
        },
        plugins: {
        title: {
            display: true,
            text: '7-Day Temperature Forecast Comparison',
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: {
            color: 'white',
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                const temp = context.raw;
                return `${context.dataset.label}: ${useMetric ? temp.toFixed(1) + '°C' : celsiusToFahrenheit(temp).toFixed(1) + '°F'}`;
            }
            }
        }
        },
        scales: {
        x: {
            title: {
            display: true,
            text: 'Date',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value, index) {
                const date = new Date(this.getLabelForValue(value));
                return date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: {
            title: {
            display: true,
            text: useMetric ? 'Temperature (°C)' : 'Temperature (°F)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return useMetric ? value + '°C' : celsiusToFahrenheit(value).toFixed(1) + '°F';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize temperature comparison chart
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    tempChart = new Chart(tempCtx, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [
        { 
            label: 'City A',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4,
            pointHitRadius: 10
        },
        { 
            label: 'City B',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4,
            pointHitRadius: 10
        }
        ]
    },
    options: {
        responsive: true,
        plugins: {
        title: {
            display: true,
            text: 'Daily Temperature Comparison',
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                const temp = context.raw;
                return `${context.dataset.label}: ${useMetric ? temp.toFixed(1) + '°C' : celsiusToFahrenheit(temp).toFixed(1) + '°F'}`;
            }
            }
        }
        },
        scales: {
        x: {
            title: {
            display: true,
            text: 'Date',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value, index) {
                const date = new Date(this.getLabelForValue(value));
                return date.toLocaleDateString('en-AU', { day: 'numeric' });
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: {
            title: {
            display: true,
            text: useMetric ? 'Temperature (°C)' : 'Temperature (°F)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return useMetric ? value + '°C' : celsiusToFahrenheit(value).toFixed(1) + '°F';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize rainfall chart
    const rainCtx = document.getElementById('rainChart').getContext('2d');
    rainChart = new Chart(rainCtx, {
    type: 'bar',
    data: { 
        labels: [], 
        datasets: [
        {
            label: 'City A',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
        },
        {
            label: 'City B',
            data: [],
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1
        }
        ]
    },
    options: {
        responsive: true,
        plugins: {
        title: {
            display: true,
            text: 'Daily Rainfall Comparison',
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'rect',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                return `${context.dataset.label}: ${context.raw.toFixed(1)} mm`;
            },
            footer: function(tooltipItems) {
                const dataIndex = tooltipItems[0].dataIndex;
                const datasets = tooltipItems[0].chart.data.datasets;
                const total = datasets.reduce((sum, dataset) => sum + (dataset.data[dataIndex] || 0), 0);
                return `Total rainfall: ${total.toFixed(1)} mm`;
            }
            }
        }
        },
        scales: {
        x: {
            title: {
            display: true,
            text: 'Date',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value, index) {
                const date = new Date(this.getLabelForValue(value));
                return date.toLocaleDateString('en-AU', { day: 'numeric' });
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: {
            title: {
            display: true,
            text: 'Rainfall (mm)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return value + ' mm';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize Annual Pattern Chart with click interaction
    const annualPatternCtx = document.getElementById('annualPatternChart').getContext('2d');
    annualPatternChart = new Chart(annualPatternCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: 12}, (_, i) => new Date(2024, i).toLocaleString('default', { month: 'long' })),
        datasets: [
        {
            label: 'Max Temperature',
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4,
            pointHitRadius: 10
        },
        {
            label: 'Min Temperature',
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.4,
            pointHitRadius: 10
        }
        ]
    },
    options: {
        responsive: true,
        plugins: {
        title: { 
            display: true, 
            text: 'Monthly Temperature Pattern',
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                const temp = context.raw;
                return `${context.dataset.label}: ${useMetric ? temp.toFixed(1) + '°C' : celsiusToFahrenheit(temp).toFixed(1) + '°F'}`;
            }
            }
        }
        },
        scales: {
        x: {
            title: { 
            display: true, 
            text: 'Month', 
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: {
            title: { 
            display: true, 
            text: useMetric ? 'Temperature (°C)' : 'Temperature (°F)', 
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return useMetric ? value + '°C' : celsiusToFahrenheit(value).toFixed(1) + '°F';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize Extremes Chart
    const extremesCtx = document.getElementById('extremesChart').getContext('2d');
    extremesChart = new Chart(extremesCtx, {
    type: 'bar',
    data: {
        labels: ['Summer', 'Autumn', 'Winter', 'Spring'],
        datasets: [
        {
            label: 'Record High',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1
        },
        {
            label: 'Record Low',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
        }
        ]
    },
    options: {
        responsive: true,
        plugins: {
        title: { 
            display: true, 
            text: 'Seasonal Temperature Extremes', 
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'rect',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                const temp = context.raw;
                return `${context.dataset.label}: ${useMetric ? temp.toFixed(1) + '°C' : celsiusToFahrenheit(temp).toFixed(1) + '°F'}`;
            }
            }
        }
        },
        scales: {
        x: { 
            title: {
            display: true,
            text: 'Season',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: { 
            title: {
            display: true,
            text: useMetric ? 'Temperature (°C)' : 'Temperature (°F)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return useMetric ? value + '°C' : celsiusToFahrenheit(value).toFixed(1) + '°F';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize Monthly Rain Chart
    const monthlyRainCtx = document.getElementById('monthlyRainChart').getContext('2d');
    monthlyRainChart = new Chart(monthlyRainCtx, {
    type: 'bar',
    data: {
        labels: Array.from({length: 12}, (_, i) => new Date(2024, i).toLocaleString('default', { month: 'short' })),
        datasets: [{
        label: 'Average Rainfall',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        plugins: {
        title: { 
            display: true, 
            text: 'Monthly Rainfall Distribution', 
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'rect',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                return `Rainfall: ${context.raw.toFixed(1)} mm`;
            }
            }
        }
        },
        scales: {
        x: { 
            title: {
            display: true,
            text: 'Month',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: { 
            title: {
            display: true,
            text: 'Rainfall (mm)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return value + ' mm';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });

    // Initialize Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
        datasets: [{
        label: 'Average Temperature',
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.4,
        pointHitRadius: 10
        }]
    },
    options: {
        responsive: true,
        plugins: {
        title: { 
            display: true, 
            text: 'Long-term Temperature Trend', 
            color: 'white',
            font: { size: 16, weight: 'bold' }
        },
        legend: {
            display: true,
            position: 'top',
            labels: { 
            color: 'white',
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
            label: function(context) {
                const temp = context.raw;
                return `${context.dataset.label}: ${useMetric ? temp.toFixed(1) + '°C' : celsiusToFahrenheit(temp).toFixed(1) + '°F'}`;
            }
            }
        }
        },
        scales: {
        x: { 
            title: {
            display: true,
            text: 'Year',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: { 
            title: {
            display: true,
            text: useMetric ? 'Temperature (°C)' : 'Temperature (°F)',
            color: 'white',
            font: { size: 12, weight: 'bold' }
            },
            ticks: { 
            color: 'white',
            font: { size: 11 },
            callback: function(value) {
                return useMetric ? value + '°C' : celsiusToFahrenheit(value).toFixed(1) + '°F';
            }
            },
            grid: {
            color: 'rgba(255, 255, 255, 0.1)'
            }
        }
        }
    }
    });
}

function locateUser() {
    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        map.setView([lat, lon], 10);
        
        // Remove existing user marker if it exists
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        
        // Create a special marker for user location
        currentMarker = L.marker([lat, lon], {
            icon: L.divIcon({
            html: '📍',
            className: 'user-location',
            iconSize: [25, 25],
            iconAnchor: [12, 24]
            })
        })
            .addTo(map)
            .bindPopup("Your Location")
            .openPopup();
        
        loadCurrentWeather(lat, lon);
        },
        () => {
        alert("Unable to retrieve your location. Using default city.");
        const [lat, lon] = cities['melbourne'];
        map.setView([lat, lon], 10);
        loadCurrentWeather(lat, lon);
        }
    );
    } else {
    alert("Geolocation not supported.");
    }
}

// Update forecast chart function
async function updateForecastChart() {
    const cityA = document.getElementById('forecastCityA').value;
    const cityB = document.getElementById('forecastCityB').value;
    
    try {
    // Fetch data for both cities
    const [cityAData, cityBData] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cities[cityA][0]}&longitude=${cities[cityA][1]}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`).then(res => res.json()),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cities[cityB][0]}&longitude=${cities[cityB][1]}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`).then(res => res.json())
    ]);

    if (!cityAData.daily || !cityBData.daily) {
        console.error('Invalid forecast data received');
        return;
    }

    const maxTempsA = cityAData.daily.temperature_2m_max.map(temp => useMetric ? temp : celsiusToFahrenheit(temp));
    const minTempsA = cityAData.daily.temperature_2m_min.map(temp => useMetric ? temp : celsiusToFahrenheit(temp));
    const maxTempsB = cityBData.daily.temperature_2m_max.map(temp => useMetric ? temp : celsiusToFahrenheit(temp));
    const minTempsB = cityBData.daily.temperature_2m_min.map(temp => useMetric ? temp : celsiusToFahrenheit(temp));

    // Update chart data
    forecastChart.data.labels = cityAData.daily.time;
    forecastChart.data.datasets[0].data = maxTempsA;
    forecastChart.data.datasets[1].data = minTempsA;
    forecastChart.data.datasets[2].data = maxTempsB;
    forecastChart.data.datasets[3].data = minTempsB;

    // Update dataset labels
    forecastChart.data.datasets[0].label = `${cityA.charAt(0).toUpperCase() + cityA.slice(1)} Max`;
    forecastChart.data.datasets[1].label = `${cityA.charAt(0).toUpperCase() + cityA.slice(1)} Min`;
    forecastChart.data.datasets[2].label = `${cityB.charAt(0).toUpperCase() + cityB.slice(1)} Max`;
    forecastChart.data.datasets[3].label = `${cityB.charAt(0).toUpperCase() + cityB.slice(1)} Min`;

    // Clear existing annotations
    forecastChart.options.plugins.annotation.annotations = {};

    // Add temperature labels for each data point
    [maxTempsA, minTempsA, maxTempsB, minTempsB].forEach((temps, datasetIndex) => {
        temps.forEach((temp, index) => {
        forecastChart.options.plugins.annotation.annotations[`temp-${datasetIndex}-${index}`] = {
            type: 'point',
            xValue: index,
            yValue: temp,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            label: {
            enabled: true,
            content: useMetric ? `${temp.toFixed(1)}°C` : `${temp.toFixed(1)}°F`,
            position: datasetIndex % 2 === 0 ? 'top' : 'bottom',
            yAdjust: datasetIndex % 2 === 0 ? -10 : 10,
            color: 'white',
            backgroundColor: forecastChart.data.datasets[datasetIndex].backgroundColor
            }
        };
        });
    });

    forecastChart.options.scales.y.title.text = useMetric ? 'Temperature (°C)' : 'Temperature (°F)';
    forecastChart.update('none');
    } catch (error) {
    console.error('Error updating forecast chart:', error);
    }
}

// Function to update weather icon for a city
async function updateCityWeatherIcon(city, lat, lon) {
    try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const weatherCode = data.current_weather.weathercode;
    const iconUrl = weatherIcons[weatherCode] || weatherIcons[0];

    if (cityMarkers[city]) {
        map.removeLayer(cityMarkers[city]);
    }

    cityMarkers[city] = L.marker([lat, lon], {
        icon: createWeatherIcon(iconUrl, weatherCode)
    })
        .addTo(map)
        .bindPopup(
        `${city.charAt(0).toUpperCase() + city.slice(1)}<br>` +
        `Temperature: ${formatTemperature(data.current_weather.temperature)}<br>` +
        `Wind: ${formatWindSpeed(data.current_weather.windspeed)}`
        );
    } catch (error) {
    console.error(`Error updating weather icon for ${city}:`, error);
    }
}

// Conversion functions
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

function fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
}

function kmhToMph(kmh) {
    return kmh * 0.621371;
}

function mphToKmh(mph) {
    return mph / 0.621371;
}

function formatTemperature(celsius) {
    if (useMetric) {
    return `${celsius.toFixed(1)}°C`;
    }
    return `${celsiusToFahrenheit(celsius).toFixed(1)}°F`;
}

function formatWindSpeed(kmh) {
    if (useMetric) {
    return `${kmh.toFixed(1)} km/h`;
    }
    return `${kmhToMph(kmh).toFixed(1)} mph`;
}

function toggleUnits() {
    useMetric = !useMetric;
    
    // Update toggle button
    const unitText = document.getElementById('unitText');
    unitText.textContent = useMetric ? '°C / km/h' : '°F / mph';
    
    // Update all charts
    if (forecastChart) {
    updateForecastChart();
    }
    if (tempChart) {
    updatePastWeather();
    }
    if (annualPatternChart) {
    updateAnnualPattern();
    }
    if (extremesChart) {
    updateExtremesAndRainfall();
    }
    if (trendChart) {
    updateTrendAnalysis();
    }
    
    // Update all displayed weather data
    Object.entries(cities).forEach(([city, [lat, lon]]) => {
    updateCityWeatherIcon(city, lat, lon);
    });
    
    // Update current weather cards
    const weatherElements = document.querySelectorAll('[data-weather]');
    weatherElements.forEach(element => {
    const type = element.getAttribute('data-weather');
    const value = parseFloat(element.getAttribute('data-value'));
    const icon = element.getAttribute('data-icon') || '';
    
    if (type === 'temperature') {
        element.textContent = `${formatTemperature(value)} ${icon}`;
    } else if (type === 'wind') {
        element.textContent = `${formatWindSpeed(value)} ${icon}`;
    }
    });

    // Update map legends if they exist
    if (window.currentLegend) {
    map.removeControl(window.currentLegend);
    createLegend(currentLayer).addTo(map);
    }

    // Update choropleth layers if they exist
    if (temperatureLayer) {
    temperatureLayer.remove();
    temperatureLayer = createChoroplethLayer('temperature');
    if (currentLayer === 'temperature') {
        temperatureLayer.addTo(map);
    }
    }
    if (rainfallLayer) {
    rainfallLayer.remove();
    rainfallLayer = createChoroplethLayer('rainfall');
    if (currentLayer === 'rainfall') {
        rainfallLayer.addTo(map);
    }
    }
}

function showSection(name) {
    document.getElementById("current").classList.add("hidden");
    document.getElementById("past").classList.add("hidden");
    document.getElementById(name).classList.remove("hidden");
}

function windDirection(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

// use BOM to retrieve the most recent data
async function loadCurrentWeather(lat, lon) {
    try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    const current = data.current_weather;
    const daily = data.daily;

    const cards = document.getElementById("cards");
    cards.innerHTML = '';
    cards.innerHTML += createCard("Temperature", current.temperature, "🌡️", "temperature");
    cards.innerHTML += createCard("Wind", current.windspeed, "💨", "wind");
    cards.innerHTML += createCard("Direction", windDirection(current.winddirection), "🧭");
    cards.innerHTML += createCard("Rain", `${daily.precipitation_sum[0]} mm`, "☔");

    updateForecastChart(daily);
    } catch (error) {
    console.error("Error loading current weather:", error);
    }
}

async function loadPastWeatherCompare(cityA, cityB, year, month) {
const start = `${year}-${month}-01`;
const end = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

try {
    // Capitalize city names for the API call
    const response = await fetch(`http://127.0.0.1:5000/weather/raw?city=${cityA.charAt(0).toUpperCase() + cityA.slice(1)}&city=${cityB.charAt(0).toUpperCase() + cityB.slice(1)}`);
    const data = await response.json();

    console.log("API Response:", data); // Debugging log

    // Capitalize city names for accessing the data object
    const cityAKey = cityA.charAt(0).toUpperCase() + cityA.slice(1);
    const cityBKey = cityB.charAt(0).toUpperCase() + cityB.slice(1);

    // Check if data exists for the cities
    if (!data[cityAKey] || !data[cityBKey]) {
        console.error("No data available for the selected cities.");
        return;
    }

    // Filter data for the selected month
    const cityAData = data[cityAKey].filter(record => record.date >= start && record.date <= end);
    const cityBData = data[cityBKey].filter(record => record.date >= start && record.date <= end);

    console.log("City A Data:", cityAData); // Debugging log
    console.log("City B Data:", cityBData); // Debugging log

    // Update temperature chart
    tempChart.data.labels = cityAData.map(record => record.date);
    tempChart.data.datasets[0].label = cityAKey;
    tempChart.data.datasets[1].label = cityBKey;
    tempChart.data.datasets[0].data = cityAData.map(record => record.temperature_2m_max);
    tempChart.data.datasets[1].data = cityBData.map(record => record.temperature_2m_max);

tempChart.update();

// Update rainfall chart
    rainChart.data.labels = cityAData.map(record => record.date);
    rainChart.data.datasets[0].label = cityAKey;
    rainChart.data.datasets[1].label = cityBKey;
    rainChart.data.datasets[0].data = cityAData.map(record => record.precipitation_sum);
    rainChart.data.datasets[1].data = cityBData.map(record => record.precipitation_sum);

    rainChart.update();
    } catch (error) {
    console.error("Error loading past weather data:", error);
    }
}

function updatePastWeather() {
const cityA = document.getElementById("pastCitySelectA").value;
const cityB = document.getElementById("pastCitySelectB").value;
const year = document.getElementById("yearSelect").value;
const month = document.getElementById("monthSelect").value;
loadPastWeatherCompare(cityA, cityB, year, month);
}

function createCard(title, value, icon = '', type = '') {
    let displayValue = value;
    let originalValue = '';
    
    if (type === 'temperature') {
    originalValue = parseFloat(value);
    displayValue = formatTemperature(originalValue);
    } else if (type === 'wind') {
    originalValue = parseFloat(value);
    displayValue = formatWindSpeed(originalValue);
    }

    return `<div class="bg-gray-800 p-4 rounded-lg shadow-md">
    <h2 class="text-md font-semibold mb-2">${title}</h2>
    <p class="text-2xl font-bold" data-weather="${type}" data-value="${originalValue}" data-icon="${icon}">${displayValue} ${icon}</p>
    </div>`;
}

document.getElementById("currentCitySelect").addEventListener("change", (e) => {
    const city = e.target.value;
    const [lat, lon] = cities[city];
    
    // Remove existing marker
    if (currentMarker) {
    map.removeLayer(currentMarker);
    }
    
    // Add new marker and center map
    map.setView([lat, lon], 7);
    currentMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup(city.charAt(0).toUpperCase() + city.slice(1))
    .openPopup();
    
    // Load current weather for the selected city
    loadCurrentWeather(lat, lon);
});

// Add event listeners to automatically apply past weather selection
document.getElementById("pastCitySelectA").addEventListener("change", updatePastWeather);
document.getElementById("pastCitySelectB").addEventListener("change", updatePastWeather);
document.getElementById("yearSelect").addEventListener("change", updatePastWeather);
document.getElementById("monthSelect").addEventListener("change", updatePastWeather);

const now = new Date().getFullYear();
const yearSel = document.getElementById("yearSelect");
for (let y = now; y >= now - 20; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
}

// Initial load for Melbourne and past weather
loadCurrentWeather(...cities['melbourne']);
updatePastWeather();

// Add new update functions for the charts
async function updateAnnualPattern() {
    const city = document.getElementById('annualCitySelect').value;
    const year = document.getElementById('annualYearSelect').value;

    try {
            // Fetch data from the backend
    const response = await fetch(`http://127.0.0.1:5000/weather/raw?city=${city.charAt(0).toUpperCase() + city.slice(1)}`);
    const data = await response.json();

    const cityKey = city.charAt(0).toUpperCase() + city.slice(1);
    const cityData = data[cityKey].filter(record => record.date.startsWith(year));

    // Process data into monthly averages
    const monthlyData = Array(12).fill().map(() => ({ max: [], min: [] }));
    cityData.forEach(record => {
        const month = new Date(record.date).getMonth();
        monthlyData[month].max.push(record.temperature_2m_max);
        monthlyData[month].min.push(record.temperature_2m_min); 
    });

    // Calculate monthly averages
    const monthlyAverages = monthlyData.map(month => ({
        max: month.max.length > 0 ? month.max.reduce((a, b) => a + b, 0) / month.max.length : null,
        min: month.min.length > 0 ? month.min.reduce((a, b) => a + b, 0) / month.min.length : null
    }));

    // Update chart
    annualPatternChart.data.datasets[0].data = monthlyAverages.map(m => 
        m.max !== null ? (useMetric ? m.max : celsiusToFahrenheit(m.max)) : null
    );
    annualPatternChart.data.datasets[1].data = monthlyAverages.map(m => 
        m.min !== null ? (useMetric ? m.min : celsiusToFahrenheit(m.min)) : null
    );

    annualPatternChart.update();
    } catch (error) {
    console.error('Error updating annual pattern:', error);
    }
}

async function updateTrendAnalysis() {
    const city = document.getElementById('trendCitySelect').value;
    const startYear = parseInt(document.getElementById('trendStartYear').value);
    const endYear = parseInt(document.getElementById('trendEndYear').value);
    
    try {
    // Fetch data from the backend
    const response = await fetch(`http://127.0.0.1:5000/weather/raw?city=${city.charAt(0).toUpperCase() + city.slice(1)}`);
    const data = await response.json();
    
    const cityKey = city.charAt(0).toUpperCase() + city.slice(1);
    const cityData = data[cityKey];

    if (!cityData) {
        console.error('No data available for', cityKey);
        return;
    }

    // Process data into yearly averages
    const yearlyData = {};
    cityData.forEach(record => {
        const year = parseInt(record.date.split('-')[0]);
        if (year >= startYear && year <= endYear) {
        if (!yearlyData[year]) {
            yearlyData[year] = { temps: [], count: 0 };
        }
        // Use average of max and min for daily average
        const dailyAvg = (record.temperature_2m_max + record.temperature_2m_min) / 2;
        yearlyData[year].temps.push(dailyAvg);
        yearlyData[year].count++;
        }
    });

    // Calculate yearly averages
    const years = Object.keys(yearlyData)
        .map(Number)
        .sort((a, b) => a - b);
        
    const averages = years.map(year => ({
        year,
        avg: yearlyData[year].temps.reduce((a, b) => a + b, 0) / yearlyData[year].temps.length
    }));

    // Calculate trend line
    const n = averages.length;
    const sumX = years.reduce((a, b) => a + b, 0);
    const sumY = averages.reduce((a, b) => a + b.avg, 0);
    const sumXY = averages.reduce((a, b) => a + (b.year * b.avg), 0);
    const sumXX = years.reduce((a, b) => a + (b * b), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Create trend line points
    const trendLine = years.map(year => ({
        year,
        value: slope * year + intercept
    }));

    // Update chart data
    trendChart.data.labels = years;
    trendChart.data.datasets = [
        {
        label: 'Average Temperature',
        data: averages.map(point => useMetric ? point.avg : celsiusToFahrenheit(point.avg)),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.4,
        pointHitRadius: 10
        },
        {
        label: 'Trend Line',
        data: trendLine.map(point => useMetric ? point.value : celsiusToFahrenheit(point.value)),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
        }
    ];

    // Update chart options
    trendChart.options.plugins.title.text = `Temperature Trend Analysis: ${cityKey} (${startYear}-${endYear})`;
    trendChart.options.scales.y.title.text = useMetric ? 'Average Temperature (°C)' : 'Average Temperature (°F)';
    
    // Calculate total change and rate
    const totalChange = trendLine[trendLine.length - 1].value - trendLine[0].value;
    const ratePerDecade = (totalChange / (endYear - startYear)) * 10;
    
    // Add annotation for trend information
    trendChart.options.plugins.annotation = {
        annotations: {
        trendInfo: {
            type: 'label',
            xValue: years[Math.floor(years.length / 2)],
            yValue: Math.max(...averages.map(p => p.avg)) + 1,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            content: `Trend: ${ratePerDecade.toFixed(2)}°C per decade`,
            color: 'white',
            font: { size: 12 },
            padding: 6
        }
        }
    };

    trendChart.update();
    } catch (error) {
    console.error('Error updating trend analysis:', error);
    }
}

async function updateExtremesAndRainfall() {
    const city = document.getElementById('annualCitySelect').value;
    const year = document.getElementById('annualYearSelect').value;
    
    try {
    // Fetch data from the backend
    const response = await fetch(`http://127.0.0.1:5000/weather/raw?city=${city.charAt(0).toUpperCase() + city.slice(1)}`);
    const data = await response.json();
    
    const cityKey = city.charAt(0).toUpperCase() + city.slice(1);
    const cityData = data[cityKey].filter(record => record.date.startsWith(year));

    // Process data for seasonal extremes
    const seasonalData = {
        Summer: { max: [], min: [] },
        Autumn: { max: [], min: [] },
        Winter: { max: [], min: [] },
        Spring: { max: [], min: [] }
    };

    cityData.forEach(record => {
        const month = new Date(record.date).getMonth();
        let season;
        if (month >= 11 || month <= 1) season = 'Summer';
        else if (month >= 2 && month <= 4) season = 'Autumn';
        else if (month >= 5 && month <= 7) season = 'Winter';
        else season = 'Spring';

        seasonalData[season].max.push(record.temperature_2m_max);
        seasonalData[season].min.push(record.temperature_2m_min);
        });

    // Calculate seasonal extremes
    const extremes = Object.entries(seasonalData).map(([season, data]) => ({
        season,
        max: data.max.length > 0 ? Math.max(...data.max) : null,
        min: data.min.length > 0 ? Math.min(...data.min) : null
    }));

    // Update extremes chart
    extremesChart.data.datasets[0].data = extremes.map(e => 
        e.max !== null ? (useMetric ? e.max : celsiusToFahrenheit(e.max)) : null
    );
    extremesChart.data.datasets[1].data = extremes.map(e => 
        e.min !== null ? (useMetric ? e.min : celsiusToFahrenheit(e.min)) : null
    );

    extremesChart.update();

    // Process monthly rainfall data
    const monthlyRain = Array(12).fill(0);
    cityData.forEach(record => {
        const month = new Date(record.date).getMonth();
        monthlyRain[month] += record.precipitation_sum;
    });

    // Update rainfall chart
    monthlyRainChart.data.datasets[0].data = monthlyRain;
    monthlyRainChart.update();
    } catch (error) {
    console.error('Error updating extremes and rainfall:', error);
    }
    }

    function downloadChartImageLocal(chart, filename = 'chart.png') {
    chart.update(); 
    setTimeout(() => {
    const link = document.createElement('a');
    link.href = chart.toBase64Image('image/png', 1.0);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    }, 300);
}

// Add event listeners for forecast city selectors
document.getElementById('forecastCityA').addEventListener('change', updateForecastChart);
document.getElementById('forecastCityB').addEventListener('change', updateForecastChart);
