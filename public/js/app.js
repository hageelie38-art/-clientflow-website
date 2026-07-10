(() => {
  const REFRESH_MS = 30000;

  const state = {
    calls: [],
    appointments: [],
    callFilter: 'all',
    expandedCallId: null,
  };

  const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Tabs ----------
  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.setAttribute('aria-selected', 'false'));
        tab.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.panel').forEach((p) => {
          p.hidden = p.id !== `panel-${tab.dataset.tab}`;
        });
      });
    });
  }

  // ---------- Overview ----------
  async function loadOverview() {
    try {
      const stats = await Api.getStats();
      document.getElementById('stat-total-calls').textContent = stats.total_calls.toLocaleString();
      document.getElementById('stat-after-hours').textContent = stats.after_hours_calls.toLocaleString();
      document.getElementById('stat-booked').textContent = stats.appointments_booked.toLocaleString();
      document.getElementById('stat-revenue').textContent = fmtCurrency(stats.estimated_revenue);

      Charts.renderGauge(document.getElementById('gauge-container'), stats.booking_rate);

      const sentence =
        stats.total_calls > 0
          ? `${stats.after_hours_calls} of ${stats.total_calls} calls came in after hours — every one was answered and logged.`
          : 'Waiting on the first call to come in.';
      document.getElementById('summary-sentence').textContent = sentence;

      setUpdatedAt();
    } catch (err) {
      console.error(err);
      document.getElementById('summary-sentence').textContent = 'Could not load stats right now.';
    }

    try {
      const { appointments } = await Api.getAppointments();
      renderUpcoming(appointments);
    } catch (err) {
      console.error(err);
    }
  }

  function renderUpcoming(appointments) {
    const list = document.getElementById('upcoming-list');
    const now = Date.now();
    const upcoming = appointments
      .filter((a) => a.appointment_date_time && new Date(a.appointment_date_time).getTime() >= now)
      .sort((a, b) => new Date(a.appointment_date_time) - new Date(b.appointment_date_time))
      .slice(0, 5);

    if (!upcoming.length) {
      list.innerHTML = '<li class="empty-state">No upcoming appointments.</li>';
      return;
    }

    list.innerHTML = upcoming
      .map(
        (a) => `
      <li class="upcoming-item">
        <div class="upcoming-main">
          <span class="upcoming-name">${escapeHtml(a.customer_name || 'Unknown')}</span>
          <span class="upcoming-meta">${escapeHtml(a.service_type || '—')}${a.technician_assigned ? ` · ${escapeHtml(a.technician_assigned)}` : ''}</span>
        </div>
        <div class="upcoming-when">
          <strong>${fmtDateTime(a.appointment_date_time)}</strong>
          ${escapeHtml(a.status || '')}
        </div>
      </li>`
      )
      .join('');
  }

  function setUpdatedAt() {
    document.getElementById('updated-at').textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  // ---------- Call Log ----------
  function outcomeDotClass(outcome) {
    if (outcome === 'Appointment Booked') return 'dot-teal';
    if (outcome && outcome.startsWith('Missed')) return 'dot-rose';
    if (outcome === 'Voicemail Left') return 'dot-amber';
    return 'dot-muted';
  }

  async function loadCalls() {
    try {
      const { calls } = await Api.getCalls();
      state.calls = calls;
      renderCallsTable();
    } catch (err) {
      console.error(err);
      document.getElementById('calls-tbody').innerHTML = '<tr><td colspan="7" class="empty-state">Could not load calls.</td></tr>';
    }
  }

  function filteredCalls() {
    if (state.callFilter === 'after-hours') return state.calls.filter((c) => c.after_hours);
    if (state.callFilter === 'booked') return state.calls.filter((c) => c.outcome === 'Appointment Booked');
    return state.calls;
  }

  function renderCallsTable() {
    const tbody = document.getElementById('calls-tbody');
    const rows = filteredCalls();
    document.getElementById('calls-count').textContent = `${rows.length} call${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No calls match this filter.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr class="row-clickable${state.expandedCallId === c.id ? ' is-expanded' : ''}" data-call-id="${c.id}">
        <td>${escapeHtml(c.caller_name)}</td>
        <td>${escapeHtml(c.phone_number)}</td>
        <td>${fmtDateTime(c.call_date_time)}</td>
        <td>${escapeHtml(c.call_type)}</td>
        <td><span class="status-dot ${outcomeDotClass(c.outcome)}"></span>${escapeHtml(c.outcome)}</td>
        <td class="num">${c.est_job_value ? fmtCurrency(c.est_job_value) : '—'}</td>
        <td>${c.after_hours ? 'Yes' : 'No'}</td>
      </tr>
      ${
        state.expandedCallId === c.id
          ? `<tr class="transcript-row"><td colspan="7"><div class="transcript-box">${escapeHtml(c.transcript) || 'No transcript available.'}</div></td></tr>`
          : ''
      }`
      )
      .join('');

    tbody.querySelectorAll('tr.row-clickable').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.callId;
        state.expandedCallId = state.expandedCallId === id ? null : id;
        renderCallsTable();
      });
    });
  }

  function initCallFilters() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.callFilter = btn.dataset.filter;
        state.expandedCallId = null;
        renderCallsTable();
      });
    });
  }

  // ---------- Booked Appointments ----------
  async function loadAppointments() {
    try {
      const { appointments } = await Api.getAppointments();
      state.appointments = appointments;
      renderAppointmentsTable();
    } catch (err) {
      console.error(err);
      document.getElementById('appointments-tbody').innerHTML =
        '<tr><td colspan="6" class="empty-state">Could not load appointments.</td></tr>';
    }
  }

  function statusDotClass(status) {
    if (status === 'Completed') return 'dot-teal';
    if (status === 'Scheduled') return 'dot-amber';
    if (status === 'Cancelled' || status === 'No-Show') return 'dot-rose';
    return 'dot-muted';
  }

  function renderAppointmentsTable() {
    const tbody = document.getElementById('appointments-tbody');
    const rows = state.appointments;
    document.getElementById('appointments-count').textContent = `${rows.length} appointment${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No booked appointments yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(
        (a) => `
      <tr>
        <td>${escapeHtml(a.customer_name)}</td>
        <td>${escapeHtml(a.service_type)}</td>
        <td>${fmtDateTime(a.appointment_date_time)}</td>
        <td><span class="status-dot ${statusDotClass(a.status)}"></span>${escapeHtml(a.status)}</td>
        <td class="num">${fmtCurrency(a.estimated_value)}</td>
        <td>${escapeHtml(a.technician_assigned) || '—'}</td>
      </tr>`
      )
      .join('');
  }

  function downloadCsv() {
    const headers = ['Customer Name', 'Service Type', 'Appointment Date/Time', 'Status', 'Estimated Value', 'Technician Assigned'];
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(csvEscape).join(',')];
    state.appointments.forEach((a) => {
      lines.push(
        [a.customer_name, a.service_type, a.appointment_date_time || '', a.status, a.estimated_value, a.technician_assigned]
          .map(csvEscape)
          .join(',')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientflow-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Monthly Summary ----------
  async function loadMonthly() {
    try {
      const { months } = await Api.getMonthlySummary();
      renderMonthlyTable(months);
      Charts.renderBarChart(
        document.getElementById('chart-total-calls'),
        months.map((m) => ({ label: m.month, value: m.total_calls })),
        { color: '#5eead4', valueLabel: 'Calls' }
      );
      Charts.renderLineChart(
        document.getElementById('chart-booking-rate'),
        months.map((m) => ({ label: m.month, value: m.booking_rate })),
        { color: '#fb923c', valueLabel: 'Booking rate' }
      );
    } catch (err) {
      console.error(err);
      document.getElementById('monthly-tbody').innerHTML = '<tr><td colspan="7" class="empty-state">Could not load monthly summary.</td></tr>';
    }
  }

  function renderMonthlyTable(months) {
    const tbody = document.getElementById('monthly-tbody');
    if (!months.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No monthly data yet.</td></tr>';
      return;
    }
    tbody.innerHTML = months
      .map(
        (m) => `
      <tr>
        <td>${escapeHtml(m.month)}</td>
        <td class="num">${m.total_calls.toLocaleString()}</td>
        <td class="num">${m.after_hours_calls.toLocaleString()}</td>
        <td class="num">${m.appointments_booked.toLocaleString()}</td>
        <td class="num">${m.booking_rate}%</td>
        <td class="num">${fmtCurrency(m.estimated_revenue)}</td>
        <td class="num">${m.calls_would_have_missed.toLocaleString()}</td>
      </tr>`
      )
      .join('');
  }

  // ---------- Init ----------
  function init() {
    initTabs();
    initCallFilters();
    document.getElementById('export-csv-btn').addEventListener('click', downloadCsv);

    const refreshAll = () => {
      loadOverview();
      loadCalls();
      loadAppointments();
      loadMonthly();
    };

    refreshAll();
    setInterval(refreshAll, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
