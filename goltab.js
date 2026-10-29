(() => {
  const cv = document.getElementById("canvas");
  const ctx = cv.getContext("2d", { alpha: false });
  const CELL = 12, TICK = 90, HIST = 40, GRACE = 100;

  let cols = 0, rows = 0, cell = CELL, gap = 1, img;
  let grid = new Uint8Array(0), next = grid;
  let running = true, drawing = false, dirty = false, timer = 0, idle = 0, hist = [], px = 0, py = 0;

  function wake() {
    if (!dirty) { dirty = true; requestAnimationFrame(draw); }
  }

  function resize() {
    const d = devicePixelRatio || 1;
    cv.width = Math.round(innerWidth * d);
    cv.height = Math.round(innerHeight * d);
    cell = Math.round(CELL * d);
    gap = Math.max(1, Math.round(d));
    const nc = Math.ceil(cv.width / cell), nr = Math.ceil(cv.height / cell);
    const ng = new Uint8Array(nc * nr), first = !grid.length;
    for (let y = 0; y < Math.min(rows, nr); y++)
      ng.set(grid.subarray(y * cols, y * cols + Math.min(cols, nc)), y * nc);
    cols = nc; rows = nr; grid = ng; next = new Uint8Array(nc * nr);

    img = document.createElement("canvas");
    img.width = cv.width; img.height = cv.height;
    const g = img.getContext("2d");
    g.fillStyle = "#282828"; g.fillRect(0, 0, img.width, img.height);
    g.fillStyle = "#32302f";
    for (let x = 0; x <= img.width; x += cell) g.fillRect(x, 0, gap, img.height);
    for (let y = 0; y <= img.height; y += cell) g.fillRect(0, y, img.width, gap);

    if (first) randomize(0.15, true);
    wake();
  }

  function randomize(p, clear) {
    for (let i = 0; i < grid.length; i++) {
      if (Math.random() < p) grid[i] = 1;
      else if (clear) grid[i] = 0;
    }
    hist = [];
    wake();
  }

  function step() {
    let pop = 0;
    for (let y = 0; y < rows; y++) {
      const r0 = (y ? y - 1 : rows - 1) * cols, r1 = y * cols, r2 = (y < rows - 1 ? y + 1 : 0) * cols;
      for (let x = 0; x < cols; x++) {
        const l = x ? x - 1 : cols - 1, r = x < cols - 1 ? x + 1 : 0;
        const n = grid[r0 + l] + grid[r0 + x] + grid[r0 + r]
                + grid[r1 + l]               + grid[r1 + r]
                + grid[r2 + l] + grid[r2 + x] + grid[r2 + r];
        pop += next[r1 + x] = (n === 3 || (n === 2 && grid[r1 + x])) ? 1 : 0;
      }
    }
    [grid, next] = [next, grid];
    return pop;
  }

  function draw() {
    dirty = false;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "#a9b665";
    const s = cell - 2 * gap;
    ctx.beginPath();
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (grid[y * cols + x]) ctx.rect(x * cell + gap, y * cell + gap, s, s);
    ctx.fill();
  }

  function tick() {
    const pop = step();
    hist.push(pop);
    if (hist.length > HIST) hist.shift();
    // dead or stuck -> sprinkle new life (not right after the user edits)
    if (++idle > GRACE && (pop < cols * rows * 0.005 ||
        (hist.length === HIST && Math.max(...hist) - Math.min(...hist) <= 2))) {
      randomize(0.08, false);
    }
    wake();
    timer = setTimeout(tick, TICK);
  }

  function sync() {                       // timer runs only while running + visible
    clearTimeout(timer);
    if (running && !document.hidden) timer = setTimeout(tick, TICK);
  }

  const cellAt = e => [Math.floor(e.clientX * cv.width / innerWidth / cell),
                       Math.floor(e.clientY * cv.height / innerHeight / cell)];

  function paintTo(e) {                   // fill the line from last cell, no gaps
    const [x, y] = cellAt(e), n = Math.max(Math.abs(x - px), Math.abs(y - py)) || 1;
    for (let i = 0; i <= n; i++) {
      const cx = Math.round(px + (x - px) * i / n), cy = Math.round(py + (y - py) * i / n);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy * cols + cx] = 1;
    }
    px = x; py = y; idle = 0; hist = [];
    wake();
  }

  cv.addEventListener("mousedown", e => {
    if (e.button === 0) { drawing = true; [px, py] = cellAt(e); paintTo(e); }
  });
  addEventListener("mousemove", e => { if (drawing) paintTo(e); });
  addEventListener("mouseup", () => { drawing = false; });
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { sync(); wake(); });

  addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.code === "Space") { e.preventDefault(); if (!e.repeat) { running = !running; sync(); } }
    else if (k === "s") { step(); wake(); }
    else if (k === "r") { randomize(0.15, true); idle = 0; }
    else if (k === "c") { grid.fill(0); hist = []; idle = 0; running = false; sync(); wake(); }
  });

  resize();
  sync();
})();
