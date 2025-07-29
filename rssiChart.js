export let chart = null;

export function initRssiChart() {
  const canvas = document.getElementById('rssiChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Signalstärke dBm',
        data: [],
        fill: false,
        borderColor: 'blue',
        tension: 0.1
      }]
    },
    options: {
      animation: false,
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

export function addRssi(value) {
  if (!chart) return;
  const time = new Date().toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > 50) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}
