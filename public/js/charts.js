// Lightweight, dependency-free SVG charts (bar, line, gauge) matching the
// ClientFlow AI dark theme. No charting library — just inline SVG + a shared
// hover tooltip.
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const tooltipEl = document.getElementById('tooltip');

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, value);
      }
    }
    return node;
  }

  function formatCompact(value) {
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${Math.round(value)}`;
  }

  // "Nice" axis ticks so labels land on round numbers.
  function niceTicks(min, max, count = 4) {
    if (max === min) max = min + 1;
    const range = max - min;
    const rawStep = range / count;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const residual = rawStep / magnitude;
    let step;
    if (residual > 5) step = 10 * magnitude;
    else if (residual > 2) step = 5 * magnitude;
    else if (residual > 1) step = 2 * magnitude;
    else step = magnitude;

    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step / 2; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return ticks;
  }

  function showTooltip(evt, html) {
    tooltipEl.innerHTML = html;
    tooltipEl.hidden = false;
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltipEl.hidden = true;
  }

  const M = { top: 16, right: 12, bottom: 28, left: 40 };
  const W = 560;
  const H = 260;

  function renderBarChart(container, points, { color = '#5eead4', valueLabel = 'Calls' } = {}) {
    container.innerHTML = '';
    if (!points.length) {
      container.innerHTML = '<p class="empty-state">No monthly data yet.</p>';
      return;
    }

    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    const maxVal = Math.max(...points.map((p) => p.value), 0);
    const ticks = niceTicks(0, maxVal, 4);
    const niceMax = ticks[ticks.length - 1] || 1;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${valueLabel} by month` });
    const plot = el('g', { transform: `translate(${M.left},${M.top})` });

    // gridlines + y-axis labels
    ticks.forEach((t) => {
      const y = innerH - (t / niceMax) * innerH;
      plot.appendChild(el('line', { x1: 0, x2: innerW, y1: y, y2: y, stroke: '#223049', 'stroke-width': 1 }));
      const label = el('text', { x: -8, y: y + 4, 'text-anchor': 'end', fill: '#64748b', 'font-size': 11 });
      label.textContent = formatCompact(t);
      plot.appendChild(label);
    });

    const bandWidth = innerW / points.length;
    const barWidth = Math.min(24, bandWidth * 0.5);

    points.forEach((p, i) => {
      const barH = niceMax > 0 ? (p.value / niceMax) * innerH : 0;
      const x = i * bandWidth + (bandWidth - barWidth) / 2;
      const y = innerH - barH;
      const radius = Math.min(4, barH);

      const path = el('path', {
        d: roundedTopRectPath(x, y, barWidth, barH, radius),
        fill: color,
      });
      path.style.cursor = 'pointer';
      path.addEventListener('mousemove', (evt) =>
        showTooltip(
          evt,
          `<div class="tt-title">${p.label}</div><div class="tt-row"><span class="swatch" style="background:${color}"></span>${valueLabel}: ${p.value.toLocaleString()}</div>`
        )
      );
      path.addEventListener('mouseleave', hideTooltip);
      plot.appendChild(path);

      const xLabel = el('text', {
        x: i * bandWidth + bandWidth / 2,
        y: innerH + 18,
        'text-anchor': 'middle',
        fill: '#94a3b8',
        'font-size': 11,
      });
      xLabel.textContent = p.label;
      plot.appendChild(xLabel);
    });

    svg.appendChild(plot);
    container.appendChild(svg);
  }

  function roundedTopRectPath(x, y, w, h, r) {
    if (h <= 0) return `M${x},${y + h} h${w} v0 h${-w} Z`;
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}
            L${x},${y + r}
            Q${x},${y} ${x + r},${y}
            L${x + w - r},${y}
            Q${x + w},${y} ${x + w},${y + r}
            L${x + w},${y + h}
            Z`;
  }

  function renderLineChart(container, points, { color = '#5eead4', valueLabel = 'Booking rate', suffix = '%' } = {}) {
    container.innerHTML = '';
    if (!points.length) {
      container.innerHTML = '<p class="empty-state">No monthly data yet.</p>';
      return;
    }

    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    const maxVal = Math.max(...points.map((p) => p.value), 10);
    const ticks = niceTicks(0, Math.max(maxVal, 100), 4).filter((t) => t <= 100);
    const niceMax = 100;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${valueLabel} trend` });
    const plot = el('g', { transform: `translate(${M.left},${M.top})` });

    ticks.forEach((t) => {
      const y = innerH - (t / niceMax) * innerH;
      plot.appendChild(el('line', { x1: 0, x2: innerW, y1: y, y2: y, stroke: '#223049', 'stroke-width': 1 }));
      const label = el('text', { x: -8, y: y + 4, 'text-anchor': 'end', fill: '#64748b', 'font-size': 11 });
      label.textContent = `${t}${suffix}`;
      plot.appendChild(label);
    });

    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
      x: points.length > 1 ? i * stepX : innerW / 2,
      y: innerH - (p.value / niceMax) * innerH,
      point: p,
    }));

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
    plot.appendChild(el('path', { d: linePath, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

    coords.forEach((c) => {
      const ring = el('circle', { cx: c.x, cy: c.y, r: 6, fill: '#111a2e', stroke: 'none' });
      const dot = el('circle', { cx: c.x, cy: c.y, r: 4, fill: color });
      const hit = el('circle', { cx: c.x, cy: c.y, r: 12, fill: 'transparent' });
      hit.style.cursor = 'pointer';
      hit.addEventListener('mousemove', (evt) =>
        showTooltip(
          evt,
          `<div class="tt-title">${c.point.label}</div><div class="tt-row"><span class="swatch" style="background:${color}"></span>${valueLabel}: ${c.point.value}${suffix}</div>`
        )
      );
      hit.addEventListener('mouseleave', hideTooltip);
      plot.appendChild(ring);
      plot.appendChild(dot);
      plot.appendChild(hit);

      const xLabel = el('text', { x: c.x, y: innerH + 18, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 11 });
      xLabel.textContent = c.point.label;
      plot.appendChild(xLabel);
    });

    svg.appendChild(plot);
    container.appendChild(svg);
  }

  // Semi-circle dial: teal arc for the booking rate, muted track for the rest.
  function renderGauge(container, percent) {
    container.innerHTML = '';
    const pct = Math.max(0, Math.min(100, percent));
    const size = 220;
    const cx = size / 2;
    const cy = size / 2 + 6;
    const r = 88;
    const strokeW = 16;

    const svg = el('svg', { viewBox: `0 0 ${size} ${size / 2 + 40}`, role: 'img', 'aria-label': `Booking rate ${pct}%` });

    const arcPath = (fromDeg, toDeg) => {
      const toRad = (d) => ((d - 180) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(toRad(fromDeg));
      const y1 = cy + r * Math.sin(toRad(fromDeg));
      const x2 = cx + r * Math.cos(toRad(toDeg));
      const y2 = cy + r * Math.sin(toRad(toDeg));
      const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
      return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`;
    };

    const track = el('path', {
      d: arcPath(0, 180),
      fill: 'none',
      stroke: '#223049',
      'stroke-width': strokeW,
      'stroke-linecap': 'round',
    });
    svg.appendChild(track);

    const sweep = (pct / 100) * 180;
    if (sweep > 0) {
      const fill = el('path', {
        d: arcPath(0, sweep),
        fill: 'none',
        stroke: '#5eead4',
        'stroke-width': strokeW,
        'stroke-linecap': 'round',
      });
      svg.appendChild(fill);
    }

    const valueText = el('text', {
      x: cx,
      y: cy - 8,
      'text-anchor': 'middle',
      fill: '#e5e7eb',
      'font-size': 34,
      'font-weight': 700,
    });
    valueText.textContent = `${pct.toFixed(1)}%`;
    svg.appendChild(valueText);

    const subText = el('text', {
      x: cx,
      y: cy + 16,
      'text-anchor': 'middle',
      fill: '#94a3b8',
      'font-size': 12,
    });
    subText.textContent = 'of calls booked';
    svg.appendChild(subText);

    container.appendChild(svg);
  }

  return { renderBarChart, renderLineChart, renderGauge };
})();
