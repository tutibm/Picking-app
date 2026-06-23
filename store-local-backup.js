// Shared data store for the picking app.
// Local-first: state lives in localStorage and syncs live across browser tabs
// (office tab <-> warehouse tab) via the native `storage` event.
// When we move to Supabase, only this file gets swapped for a client that
// reads/writes the same shape and subscribes to realtime changes.

(function () {
  const KEY = "picking_orders_v1";
  const listeners = new Set();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function persist(orders) {
    localStorage.setItem(KEY, JSON.stringify(orders));
    // notify same-tab listeners (storage event only fires in *other* tabs)
    listeners.forEach((cb) => cb(orders));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Recompute order status from its lines.
  function rollup(order) {
    const lines = order.lines || [];
    const resolved = lines.filter((l) => l.status !== "pending").length;
    if (resolved === 0) order.status = "new";
    else if (resolved < lines.length) order.status = "picking";
    else order.status = "ready"; // every line resolved -> ready to invoice
    order.resolvedCount = resolved;
    return order;
  }

  const Store = {
    getOrders() {
      return load().sort((a, b) => b.createdAt - a.createdAt);
    },
    getOrder(id) {
      return load().find((o) => o.id === id) || null;
    },
    addOrder(order) {
      const orders = load();
      order.id = order.id || uid();
      order.createdAt = Date.now();
      rollup(order);
      orders.push(order);
      persist(orders);
      return order;
    },
    deleteOrder(id) {
      persist(load().filter((o) => o.id !== id));
    },
    // Apply a patch to one line, then recompute order status.
    updateLine(orderId, lineId, patch) {
      const orders = load();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return null;
      const line = order.lines.find((l) => l.id === lineId);
      if (!line) return null;
      Object.assign(line, patch);
      if (patch.status && patch.status !== "pending") line.resolvedAt = Date.now();
      if (patch.status === "pending") line.resolvedAt = null;
      rollup(order);
      persist(orders);
      return order;
    },
    setOrderStatus(orderId, status) {
      const orders = load();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      order.status = status;
      persist(orders);
    },
    // Subscribe to ALL changes (this tab + other tabs).
    subscribe(cb) {
      listeners.add(cb);
      const onStorage = (e) => {
        if (e.key === KEY) cb(load());
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    uid,
  };

  // ---- Cross-reference helper: SKU -> catalog product (EAN/DUN/name) ----
  Store.lookupSku = function (sku) {
    if (!sku) return null;
    const key = String(sku).trim().toUpperCase();
    return (window.CATALOG_BY_SKU && window.CATALOG_BY_SKU[key]) || null;
  };

  // Given a scanned code, find which line it belongs to (matches EAN or DUN).
  Store.matchScan = function (order, code) {
    const c = String(code).trim();
    if (!c) return null;
    return (
      order.lines.find((l) => l.ean === c || l.dun === c || l.sku.toUpperCase() === c.toUpperCase()) ||
      null
    );
  };

  window.Store = Store;
})();
