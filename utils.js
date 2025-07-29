export const logEntries = [];

export function print(text) {
  const out = document.getElementById("output");
  out.value += text + "\n";
  out.scrollTop = out.scrollHeight;
  if (text.startsWith('📩 Text-SDS') || text.startsWith('📍 GPS von ISSI')) {
    const msgOut = document.getElementById('sdsMessages');
    if (msgOut) {
      msgOut.value += text + '\n';
      msgOut.scrollTop = msgOut.scrollHeight;
    }
  }
  logEntries.push({ timestamp: new Date().toISOString(), text });
}

export function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export function exportToCsv() {
  const rows = ["timestamp,text"];
  logEntries.forEach(entry => {
    rows.push(`"${entry.timestamp}","${entry.text.replace(/"/g, '""')}"`);
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "log.csv";
  link.click();
}
