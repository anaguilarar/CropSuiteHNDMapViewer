
// OpenLayers based GeoTIFF visualizer with Side-by-Side Comparison
// Removes Leaflet dependencies and uses native WebGL rendering

let mapA, mapB;
let layerA = null;
let layerB = null;

// --- Color Scales ---
const SUIT_STYLE = {
  color: [
    'interpolate',
    ['linear'],
    ['band', 1],
    0, [215, 212, 213],      // 0
    20, [245, 144, 83],      // 20
    40, [254, 223, 154],     // 40
    60, [219, 240, 158],     // 60
    80, [138, 204, 98],      // 80
    100, [26, 150, 65]       // 100
  ]
};

const DIFF_STYLE = {
  color: [
    'interpolate',
    ['linear'],
    ['band', 1],
    0, [0, 0, 4],
    20, [45, 5, 61],
    40, [99, 21, 101],
    60, [159, 43, 82],
    80, [227, 89, 51],
    100, [252, 253, 191]
  ]
};

// --- Initialization ---

function initializeMaps() {
  if (mapA && mapB) return;

  const baseLayerA = new ol.layer.Tile({ source: new ol.source.OSM() });
  const baseLayerB = new ol.layer.Tile({ source: new ol.source.OSM() });
  
  // Honduras Center (Web Mercator)
  const centerWebMercator = [-9685000, 1690000];

  if (!mapA) {
    mapA = new ol.Map({
      target: 'map',
      layers: [baseLayerA],
      view: new ol.View({
        projection: 'EPSG:3857',
        center: centerWebMercator,
        zoom: 7
      })
    });
  }

  if (!mapB) {
    // Map B (Right / Comparison)
    mapB = new ol.Map({
      target: 'map-compare',
      layers: [baseLayerB],
      view: mapA.getView(), // Sync View
      controls: [] // Minimal controls
    });
  }
  
  console.log("DEBUG: Dual Maps Initialized - View Synced");
}

// --- Layer Loading ---

async function updateLayer(mapTarget) {
  // mapTarget is 'A' or 'B'
  initializeMaps();

  const isMapA = mapTarget === 'A';
  const map = isMapA ? mapA : mapB;
  let currentLayer = isMapA ? layerA : layerB;
  
  // Get Values
  // Crop is shared
  const crop = document.querySelector('input[name="crop"]:checked').value;
  
  // Scenario values depend on map
  const suffix = isMapA ? '' : '_b';
  const ssp = document.querySelector(`input[name="ssp${suffix}"]:checked`).value;
  const model = document.querySelector(`input[name="model${suffix}"]:checked`).value;
  let period = document.querySelector(`input[name="period${suffix}"]:checked`).value;
  if(ssp === "historical"){
   period = "2005_2014"; 
  }
  const url = `src/tif/ST0_${model}_${ssp}_${period}_${crop}_bl_suit.tif`;
  const is_suit = true;

  console.log(`Loading GeoTIFF for Map ${mapTarget}:`, url);

  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    // RESTORED: Define blob!
    const blob = await response.blob();

    const source = new ol.source.GeoTIFF({
      sources: [{ blob: blob }], 
      normalize: false,
      projection: 'EPSG:4326' // Force projection assumption (Essential Fix)
    });
    
    // Log Metadata (Silent or minimal)
    source.getView().catch(err => console.warn("Metadata check failed", err));

    const baseStyle = is_suit ? SUIT_STYLE : DIFF_STYLE;
    
    // Restore Original Style:
    // If val <= 0, transparent. Else interpolate.
    const colorExp = [
      'case',
      ['<=', ['band', 1], 0], [0, 0, 0, 0], // Transparent for <= 0 (NoData)
      baseStyle.color
    ];

    const newLayer = new ol.layer.WebGLTile({
      source: source,
      style: { color: colorExp }
    });

    map.addLayer(newLayer);
    
    // Update global reference
    if (isMapA) layerA = newLayer;
    else layerB = newLayer;

    // Only update legend for A (or make dynamic? For now assume similar scales)
    if (isMapA) updateLegend(is_suit);

  } catch (err) {
    console.error(`Failed to load GeoTIFF for Map ${mapTarget}:`, err);
  }
}

// --- Comparison Logic ---

function toggleCompareMode() {
  const isCompare = document.getElementById('compareModeToggle').checked;
  const mapBContainer = document.getElementById('map-compare');
  const slider = document.getElementById('swipe');
  const controlsB = document.getElementById('controls-b');

  if (isCompare) {
    mapBContainer.style.display = 'block';
    slider.style.display = 'block';
    controlsB.style.display = 'block';
    
    // Init Map B if needed and load layer
    initializeMaps();
    mapB.updateSize(); // Important when showing previously hidden map
    updateLayer('B');
    updateClip(); // Set initial clip
  } else {
    mapBContainer.style.display = 'none';
    slider.style.display = 'none';
    controlsB.style.display = 'none';
  }
}

function updateClip() {
  const slider = document.getElementById('swipe');
  const val = slider.value; // 0 to 100
  const mapBContainer = document.getElementById('map-compare');
  
  // Clip the LEFT side of Map B to reveal Map A underneath.
  // inset(top right bottom left)
  // If val is 50%, we clip 0% 0% 0% 50% ? 
  // Wait, if slider is in middle. Map A is Left. Map B is Right.
  // We want Map B to ONLY show on the Right.
  // So we clip the left 50% of Map B.
  mapBContainer.style.clipPath = `inset(0 0 0 ${val}%)`;
}


// --- Legend ---

function updateLegend(is_suit) {
  const container = document.getElementById('legend-container');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = '';
  
  let title = is_suit ? 'Suitability' : 'Difference';
  let levels = is_suit ? [
      { range: "0 - 20", color: "rgb(215,212,213)" },
      { range: "20 - 40", color: "rgb(245,144,83)" },
      { range: "40 - 60", color: "rgb(254,223,154)" },
      { range: "60 - 80", color: "rgb(219,240,158)" },
      { range: "80 - 100", color: "rgb(26,150,65)" }
    ] : [
      { range: "0 - 20", color: "rgb(0,0,4)" },
      { range: "20 - 40", color: "rgb(45,5,61)" },
      { range: "40 - 60", color: "rgb(99,21,101)" },
      { range: "60 - 80", color: "rgb(159,43,82)" },
      { range: "80 - 100", color: "rgb(252,253,191)" }
    ];

  const h4 = document.createElement('h4');
  h4.style.margin = '0 0 5px 0';
  h4.innerText = title;
  container.appendChild(h4);

  levels.forEach(l => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '3px';
    row.innerHTML = `<i style="background:${l.color}"></i> ${l.range}`;
    container.appendChild(row);
  });
}

// --- Event Listeners ---

// Compare Toggle
document.getElementById('compareModeToggle').addEventListener('change', toggleCompareMode);

// Slider
document.getElementById('swipe').addEventListener('input', updateClip);

// Scenario A Inputs
['crop', 'ssp', 'period', 'model'].forEach(name => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.addEventListener('change', () => {
      updateLayer('A'); // Always update A
      if(document.getElementById('compareModeToggle').checked) {
         if (name === 'crop') updateLayer('B'); // Crop is shared
      }
    });
  });
});

// Scenario B Inputs
['ssp_b', 'period_b', 'model_b'].forEach(name => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.addEventListener('change', () => updateLayer('B'));
  });
});

// --- Department Layer ---
let deptLayerA = null;
let deptLayerB = null;
let deptVisible = false;
let pickMode = false;

document.getElementById("pickLocationBtn").addEventListener("click", () => {
    pickMode = !pickMode;
    const btn = document.getElementById("pickLocationBtn");
    if (pickMode) {
        btn.classList.add("pick-active");
        btn.innerText = "🛑 Stop Picking";
        document.getElementById('map-wrapper').style.cursor = 'crosshair';
    } else {
        btn.classList.remove("pick-active");
        btn.innerText = "🎯 Pick on Map";
        document.getElementById('map-wrapper').style.cursor = 'default';
    }
});

async function runLocationAnalysis() {
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lon = parseFloat(document.getElementById("input-lon").value);
    const resultsDiv = document.getElementById("location-analysis-results");
    const isCompare = document.getElementById('compareModeToggle').checked;

    if (isNaN(lat) || isNaN(lon)) {
        alert("Please enter valid coordinates or pick a location on the map.");
        return;
    }

    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = 'Analyzing... <span class="loader"></span>';

    const crops = [
        { id: "banana", name: "Banana" },
        { id: "beans", name: "Beans" },
        { id: "cassava", name: "Cassava" },
        { id: "maize", name: "Maize" },
        { id: "coffeearabica", name: "Coffee Arabica" }
    ];

    const getParams = (suffix = '') => {
        const ssp = document.querySelector(`input[name="ssp${suffix}"]:checked`).value;
        const model = document.querySelector(`input[name="model${suffix}"]:checked`).value;
        let period = document.querySelector(`input[name="period${suffix}"]:checked`).value;
        if(ssp === "historical") period = "2005_2014";
        return { ssp, model, period };
    };

    const paramsA = getParams('');
    const paramsB = isCompare ? getParams('_b') : null;

    let html = isCompare 
        ? `<div style="display:flex; justify-content:space-between; font-size:11px; color:#666; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:4px;">
             <span>A: ${paramsA.ssp} (${paramsA.period})</span>
             <span>B: ${paramsB.ssp} (${paramsB.period})</span>
           </div>`
        : `<strong>Results for ${paramsA.ssp} (${paramsA.period})</strong>`;
    
    html += `<div style="margin-top:5px;">`;

    for (const crop of crops) {
        const urlA = `src/tif/ST0_${paramsA.model}_${paramsA.ssp}_${paramsA.period}_${crop.id}_bl_suit.tif`;
        try {
            const valA = await sampleGeoTIFFValue(urlA, lon, lat);
            const displayValA = (valA !== null && valA >= 0) ? `${valA.toFixed(1)}%` : "N/A";
            
            let displayVal = displayValA;
            if (isCompare) {
                const urlB = `src/tif/ST0_${paramsB.model}_${paramsB.ssp}_${paramsB.period}_${crop.id}_bl_suit.tif`;
                const valB = await sampleGeoTIFFValue(urlB, lon, lat);
                const displayValB = (valB !== null && valB >= 0) ? `${valB.toFixed(1)}%` : "N/A";
                displayVal = `<span style="color:#2196F3">${displayValA}</span> / <span style="color:#E91E63">${displayValB}</span>`;
            }

            html += `<div class="analysis-row"><span>${crop.name}</span><span>${displayVal}</span></div>`;
        } catch (err) {
            html += `<div class="analysis-row"><span>${crop.name}</span><span>Error</span></div>`;
        }
    }
    html += "</div>";
    resultsDiv.innerHTML = html;
}

async function sampleGeoTIFFValue(url, lon, lat) {
    try {
        const tiff = await GeoTIFF.fromUrl(url);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]
        const width = image.getWidth();
        const height = image.getHeight();

        if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
            return null; // Outside bounds
        }

        const resX = (bbox[2] - bbox[0]) / width;
        const resY = (bbox[3] - bbox[1]) / height;

        const px = Math.floor((lon - bbox[0]) / resX);
        const py = Math.floor((bbox[3] - lat) / resY);

        const data = await image.readRasters({ window: [px, py, px + 1, py + 1] });
        return data[0][0];
    } catch (err) {
        console.error("Sampling error:", err);
        return null;
    }
}

document.getElementById("runAnalysisBtn").addEventListener("click", runLocationAnalysis);

function handleMapClick(evt) {
    if (pickMode) {
        const coords = ol.proj.toLonLat(evt.coordinate);
        document.getElementById("input-lat").value = coords[1].toFixed(5);
        document.getElementById("input-lon").value = coords[0].toFixed(5);
        runLocationAnalysis();
        return;
    }
}

document.getElementById("toggleDeptBtn").addEventListener("click", () => {
  if (!mapA) return;
  
  if (!deptLayerA) {
    const style = new ol.style.Style({
      stroke: new ol.style.Stroke({ color: '#222', width: 1 }),
      fill: new ol.style.Fill({ color: 'rgba(0, 0, 0, 0)' }) // Transparent fill for hit detection
    });
    const source = new ol.source.Vector({
      url: 'src/data/hnd_dpts.geojson',
      format: new ol.format.GeoJSON()
    });

    deptLayerA = new ol.layer.Vector({ source: source, style: style, zIndex: 10 });
    deptLayerB = new ol.layer.Vector({ source: source, style: style, zIndex: 10 }); // Share source? Yes.
  }

  if (deptVisible) {
    mapA.removeLayer(deptLayerA);
    if (mapB) mapB.removeLayer(deptLayerB);
    deptVisible = false;
    document.getElementById('tooltip').style.display = 'none';
  } else {
    mapA.addLayer(deptLayerA);
    if (mapB) mapB.addLayer(deptLayerB);
    deptVisible = true;
  }
});

// --- Hover Tooltip Logic ---
function handlePointerMove(evt) {
  if (evt.dragging || !deptVisible) {
    document.getElementById('tooltip').style.display = 'none';
    if (typeof highlightDepartmentInChart === 'function') highlightDepartmentInChart(null);
    return;
  }

  const map = evt.map;
  const pixel = map.getEventPixel(evt.originalEvent);
  const feature = map.forEachFeatureAtPixel(pixel, (f) => f, {
    layerFilter: (l) => l === (map === mapA ? deptLayerA : deptLayerB)
  });

  const tooltip = document.getElementById('tooltip');
  if (feature) {
    const deptoName = feature.get('DEPTO');
    if (deptoName) {
      tooltip.innerText = deptoName;
      tooltip.style.display = 'block';
      tooltip.style.left = (pixel[0] + 15) + 'px';
      tooltip.style.top = (pixel[1] + 15) + 'px';
      
      // SYNC: Highlight in chart
      if (typeof highlightDepartmentInChart === 'function') highlightDepartmentInChart(deptoName);
      return;
    }
  }
  tooltip.style.display = 'none';
  if (typeof highlightDepartmentInChart === 'function') highlightDepartmentInChart(null);
}

// Init
window.addEventListener('load', () => {
    initializeMaps();
    updateLayer('A');

    // Attach hover listeners
    if (mapA) {
        mapA.on('pointermove', handlePointerMove);
        mapA.on('click', handleMapClick);
    }
    if (mapB) {
        mapB.on('pointermove', handlePointerMove);
        mapB.on('click', handleMapClick);
    }
});
