// Thin fetch wrappers for the ClientFlow AI dashboard.
const Api = (() => {
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${url} responded ${res.status}`);
    }
    return res.json();
  }

  return {
    getStats: () => getJSON('/api/stats'),
    getCalls: () => getJSON('/api/calls'),
    getAppointments: () => getJSON('/api/appointments'),
    getMonthlySummary: () => getJSON('/api/monthly-summary'),
  };
})();
