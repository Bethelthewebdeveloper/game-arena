(function () {
  const paths = {
    puzzle: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M16 13v3h3M13 16h3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 10-13h-7l0-7z"/>',
    brain: '<path d="M9 6a3 3 0 0 1 6 0 3 3 0 0 1 3 3c1.2.4 2 1.5 2 2.8 0 1.2-.7 2.2-1.8 2.7V17a2 2 0 0 1-2 2h-1M9 6a3 3 0 0 0-3 3c-1.2.4-2 1.5-2 2.8 0 1.2.7 2.2 1.8 2.7V17a2 2 0 0 0 2 2h1"/><path d="M12 6v13M9 12h6"/>',
    ball: '<circle cx="12" cy="12" r="8"/><path d="M12 4c2 2.5 3 5.2 3 8s-1 5.5-3 8M12 4c-2 2.5-3 5.2-3 8s1 5.5 3 8M4.5 9.5h15M4.5 14.5h15"/>',
    hand: '<path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5.5a1.5 1.5 0 0 1 3 0V11M14 10.5V7a1.5 1.5 0 0 1 3 0v6c0 3-2 6-5 6h-1c-3 0-5-2.2-5-5.5V11"/>',
    type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
    help: '<circle cx="12" cy="12" r="8"/><path d="M9.5 10a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.4 1-1.4 1.9V15"/><circle cx="12" cy="17.2" r=".7" fill="currentColor" stroke="none"/>',
    car: '<path d="M4 14h16l-1.5-5.2A2 2 0 0 0 16.6 7H7.4a2 2 0 0 0-1.9 1.8L4 14z"/><path d="M6 14v3h2v-1h8v1h2v-3"/><circle cx="7.5" cy="17.5" r="1.2"/><circle cx="16.5" cy="17.5" r="1.2"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    controller: '<path d="M7 16c-2.5 0-4-1.6-4-3.6C3 9.6 5.2 8 8 8h8c2.8 0 5 1.6 5 4.4 0 2-1.5 3.6-4 3.6h-1l-1.5 2h-3L10 16H7z"/><path d="M8.5 12h3M10 10.5v3M15.2 11.2h.1M17 12.8h.1"/>',
    chart: '<path d="M4 19h16M7 16v-4M12 16V8M17 16v-7"/>',
    trophy: '<path d="M8 5h8v3a4 4 0 0 1-8 0V5z"/><path d="M8 6H6a2 2 0 0 0 2 4M16 6h2a2 2 0 0 1-2 4M12 12v3M9 20h6M10 17h4"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.2-5.5"/><path d="M20 5v5h-5"/>',
    flame: '<path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8z"/><path d="M12 11c1.2 1 2 2.1 2 3.4A2 2 0 0 1 12 16"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M10 10.5c.4-.6 1-.9 2-.9 1.3 0 2 .6 2 1.5s-.8 1.4-2.2 1.7c-1.4.3-2.3.8-2.3 1.8 0 1 .9 1.6 2.3 1.6 1.1 0 1.8-.4 2.2-1"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.8-3 3.3-5 6.5-5s5.7 2 6.5 5"/>',
    spark: '<path d="M12 3v4M12 17v4M4.2 6.2l2.8 2.8M17 15l2.8 2.8M3 12h4M17 12h4M4.2 17.8 7 15M17 9l2.8-2.8"/>',
    badge: '<path d="M12 3l2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 14.5 7.7 16.9l.8-4.8L5 8.1l4.8-.7z"/>'
  };

  function svg(name, cls) {
    const body = paths[name] || paths.spark;
    const klass = cls || "h-5 w-5";
    return '<svg class="' + klass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }

  function mark(name, wrap, size) {
    return '<span class="' + (wrap || "inline-flex") + '" aria-hidden="true">' + svg(name, size || "h-5 w-5") + "</span>";
  }

  window.Icons = { svg: svg, mark: mark, names: Object.keys(paths) };
})();
