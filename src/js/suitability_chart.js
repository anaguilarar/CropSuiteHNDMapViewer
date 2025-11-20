// === Suitability Chart (bottom-right) ===
// Displays mean_value by department, color-coded by period.
// Updates automatically on crop/ssp/period change.

let suitabilityChart;
let suitabilityData = [];

async function initSuitabilityChart() {
  const container = document.getElementById("chart-container");
  suitabilityChart = echarts.init(container);

  // Load CSV once
  const response = await fetch("src/data/summary_data.csv");
  const csvText = await response.text();
  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const headers = rows.shift();

  suitabilityData = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = r[i]?.trim()));
    obj.mean_value = parseFloat(obj.mean_value);
    return obj;
  });

  updateSuitabilityChart();
}

// --- Function to update chart based on current selection ---
function updateSuitabilityChart() {
  if (!suitabilityData.length) return;

  const crop = document.querySelector('input[name="crop"]:checked')?.value;
  const ssp = document.querySelector('input[name="ssp"]:checked')?.value;
  const currentPeriod = document.querySelector('input[name="period"]:checked')?.value;

  // Filter only the selected crop + SSP
  const filtered = suitabilityData.filter(
    d => d.crop === crop && d.ssp === ssp
  );

  if (filtered.length === 0) {
    suitabilityChart.clear();
    suitabilityChart.setOption({
      title: { text: "No data available for this combination" }
    });
    return;
  }

  // Group by department and collect period values
  const grouped = {};
  filtered.forEach(d => {
    if (!grouped[d.DEPTO]) grouped[d.DEPTO] = {};
    grouped[d.DEPTO][d.period] = d.mean_value;
  });

  // Extract all available periods for this crop+SSP
  const periods = [...new Set(filtered.map(d => d.period))].sort();

  // Sort departments by currently selected period (descending)
  const deptos = Object.keys(grouped).sort((a, b) => {
    const valA = grouped[a][currentPeriod] || 0;
    const valB = grouped[b][currentPeriod] || 0;
    return valB - valA;
  });

  // Build ECharts series per period
  const series = periods.map(p => ({
    name: p,
    type: "bar",
    data: deptos.map(dep => grouped[dep][p] ?? 0),
    emphasis: { focus: "series" },
    animationDuration: 600
  }));

  const option = {
    title: {
      text: `${crop.charAt(0).toUpperCase() + crop.slice(1)} | ${ssp}`,
      left: "center",
      textStyle: { fontSize: 18 },
      top: 5
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 30, textStyle: { fontSize: 10 } },
    grid: { left: "5%", right: "20%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "value",
      name: "Suitability",
      nameLocation: "middle",   // centers the name below the axis
      nameGap: 30,              // adds vertical spacing from the axis line
      nameTextStyle: {
        fontWeight: "bold",
        fontSize: 12
      }
    },
    yAxis: {
      type: "category",
      data: deptos,
      nameGap: 10,
      nameTextStyle: {
        fontWeight: "bold",
        fontSize: 12
      },
      name: "Department"
    },
    series: series.map((s, i) => ({
    ...s,
    itemStyle: {
      color: ['#791a96ff', '#150c9bff', '#fa3487ff', '#d7191c'][i % 4] // green–yellow–orange–red
    }
  }))
  };

  suitabilityChart.setOption(option, true);
}

// --- Listen to sidebar radio buttons for live updates ---
["crop", "ssp"].forEach(name => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.addEventListener("change", updateSuitabilityChart);
  });
});

// Initialize once everything is loaded
window.addEventListener("load", initSuitabilityChart);
