// Shared data store backed by Supabase (project "Pedidos Deposito BM").
// Orders live in the cloud, so the office (PC) and warehouse (any phone) see
// the same data, syncing live via Supabase Realtime.
//
// Keeps the SAME interface the pages already use (getOrders, getOrder,
// addOrder, updateLine, setOrderStatus, subscribe, lookupSku, matchScan), so
// office.html and warehouse.html did not need changes. Reads come from an
// in-memory cache kept fresh by realtime; writes go to the database and update
// the cache optimistically for an instant feel.

(function () {
  if (!window.supabase || !window.SB_URL || !window.SB_KEY) {
    alert("Falta la configuración de Supabase (config.js / librería). Revisá la conexión.");
    return;
  }
  const client = window.supabase.createClient(window.SB_URL, window.SB_KEY);

  let cache = [];
  let loaded = false;
  const listeners = new Set();

  function notify() { listeners.forEach((cb) => cb(cache)); }

  function rollup(order) {
    const lines = order.lines || [];
    // A line counts as resolved only once the picker COMMITS it (Listo / Sin stock
    // / Parcial). A line scanned partway is "in progress" and does NOT count.
    const resolved = lines.filter((l) => l.committed).length;
    const allPicked = lines.length > 0 && lines.every((l) => l.status === "picked");
    order.canFinalize = lines.length > 0 && lines.every((l) => l.committed);
    order.complete = !!order.finalized || allPicked;   // auto when all picked, or explicit finalize
    order.resolvedCount = resolved;
    if (order.complete) order.status = "ready";
    else if (lines.some((l) => l.status !== "pending")) order.status = "picking";
    else order.status = "new";
    return order;
  }

  function fromRow(l) {
    return {
      id: l.id, sku: l.sku, name: l.name, color: l.color,
      ean: l.ean, dun: l.dun,
      qtyOrdered: l.qty_ordered, qtyPicked: l.qty_picked,
      unitsPerBulk: l.units_per_bulk, bultos: l.bultos, bultosPicked: l.bultos_picked,
      status: l.status, committed: l.committed, matched: l.matched,
    };
  }

  async function load() {
    const [{ data: os, error: e1 }, { data: ls, error: e2 }] = await Promise.all([
      client.from("orders").select("*"),
      client.from("order_lines").select("*"),
    ]);
    if (e1 || e2) { console.error(e1 || e2); return; }
    const byOrder = {};
    (ls || []).forEach((l) => { (byOrder[l.order_id] = byOrder[l.order_id] || []).push(l); });
    cache = (os || []).map((o) => {
      const lines = (byOrder[o.id] || []).sort((a, b) => a.position - b.position).map(fromRow);
      const ord = { id: o.id, number: o.number, customer: o.customer, status: o.status,
        finalized: o.finalized, createdAt: new Date(o.created_at).getTime(), lines };
      return rollup(ord);
    });
    loaded = true;
    notify();
  }

  // Coalesce bursts of realtime events into one reload.
  let t = null;
  function scheduleLoad() { clearTimeout(t); t = setTimeout(load, 150); }

  client.channel("picking-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleLoad)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_lines" }, scheduleLoad)
    .subscribe();

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  const Store = {
    getOrders() {
      return cache.slice().sort((a, b) => b.createdAt - a.createdAt);
    },
    getOrder(id) {
      return cache.find((o) => o.id === id) || null;
    },

    async addOrder(order) {
      const { data: o, error } = await client.from("orders")
        .insert({ number: order.number, customer: order.customer || "", status: "new" })
        .select().single();
      if (error) { console.error(error); alert("No se pudo guardar el pedido: " + error.message); return; }
      const rows = (order.lines || []).map((l, i) => ({
        order_id: o.id, position: i, sku: l.sku, name: l.name || "", color: l.color || "",
        ean: l.ean || "", dun: l.dun || "", qty_ordered: l.qtyOrdered || 1,
        qty_picked: l.qtyPicked || 0, units_per_bulk: l.unitsPerBulk || 1,
        bultos: l.bultos || 1, bultos_picked: l.bultosPicked || 0,
        status: l.status || "pending", matched: !!l.matched,
      }));
      if (rows.length) {
        const { error: e2 } = await client.from("order_lines").insert(rows);
        if (e2) { console.error(e2); alert("Pedido creado pero faltaron líneas: " + e2.message); }
      }
      await load();
    },

    async deleteOrder(id) {
      const { error } = await client.from("orders").delete().eq("id", id);
      if (error) console.error(error);
      await load();
    },

    async updateLine(orderId, lineId, patch) {
      // optimistic cache update
      const ord = cache.find((o) => o.id === orderId);
      if (ord) {
        const ln = ord.lines.find((l) => l.id === lineId);
        if (ln) { Object.assign(ln, patch); rollup(ord); notify(); }
      }
      const upd = {};
      if (patch.status !== undefined) upd.status = patch.status;
      if (patch.qtyPicked !== undefined) upd.qty_picked = patch.qtyPicked;
      if (patch.bultosPicked !== undefined) upd.bultos_picked = patch.bultosPicked;
      if (patch.committed !== undefined) upd.committed = patch.committed;
      upd.resolved_at = patch.status && patch.status !== "pending" ? new Date().toISOString() : null;
      const { error } = await client.from("order_lines").update(upd).eq("id", lineId);
      if (error) { console.error(error); }
      if (ord) await client.from("orders").update({ status: ord.status }).eq("id", orderId);
    },

    async setOrderStatus(orderId, status) {
      const ord = cache.find((o) => o.id === orderId);
      if (ord) { ord.status = status; notify(); }
      const { error } = await client.from("orders").update({ status }).eq("id", orderId);
      if (error) console.error(error);
    },

    // Picker is done with the order even if some lines are partial / no-stock.
    async finalizeOrder(orderId) {
      const ord = cache.find((o) => o.id === orderId);
      if (ord) { ord.finalized = true; rollup(ord); notify(); }
      const { error } = await client.from("orders").update({ finalized: true }).eq("id", orderId);
      if (error) console.error(error);
    },

    subscribe(cb) {
      listeners.add(cb);
      if (loaded) queueMicrotask(() => cb(cache));
      return () => listeners.delete(cb);
    },

    uid,

    lookupSku(sku) {
      if (!sku) return null;
      const key = String(sku).trim().toUpperCase();
      const bySku = window.CATALOG_BY_SKU || {};
      const byNorm = window.CATALOG_BY_NORM || {};
      if (bySku[key]) return bySku[key];
      // SR-tolerant: "326/3" matches "SR326/3" and vice versa
      const n = key.indexOf("SR") === 0 ? key.slice(2) : key;
      return byNorm[n] || bySku["SR" + n] || null;
    },

    matchScan(order, code) {
      const c = String(code).trim();
      if (!c) return null;
      const cu = c.toUpperCase();
      const cn = cu.indexOf("SR") === 0 ? cu.slice(2) : cu;
      const skuNorm = (s) => { const u = String(s).toUpperCase(); return u.indexOf("SR") === 0 ? u.slice(2) : u; };
      return order.lines.find((l) =>
        l.ean === c || l.dun === c || l.sku.toUpperCase() === cu || skuNorm(l.sku) === cn) || null;
    },
  };

  window.Store = Store;
  load(); // initial fetch
})();
