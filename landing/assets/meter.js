/* ==========================================================================
   Claw Compute — landing page behaviour
   The escrow meter replays one booking end to end using the same arithmetic
   the ClawEscrow contract performs: lock the reservation, settle 85/15 on the
   time actually used, refund the remainder. Numbers are simulated; the split
   and the rounding are not.
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- copy */

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var target = document.querySelector(button.getAttribute("data-copy"));
      if (!target || !navigator.clipboard) return;
      navigator.clipboard.writeText(target.textContent.trim()).then(function () {
        button.setAttribute("data-copied", "true");
        button.setAttribute("aria-label", "Install command copied");
        setTimeout(function () {
          button.removeAttribute("data-copied");
          button.setAttribute("aria-label", "Copy the install command");
        }, 1600);
      });
    });
  });

  /* -------------------------------------------------------------- reveal */

  var revealables = document.querySelectorAll("[data-reveal]");
  if (reduced || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("shown"); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("shown");
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* --------------------------------------------------------------- meter */

  var root = document.getElementById("meter");
  if (!root) return;

  var COMMISSION = 0.15;

  // Reserved longer than used, except the last one — a booking that runs the
  // full hour refunds nothing, and the meter should show that case too.
  var BOOKINGS = [
    { machine: "M3 Max · 64 GB",  workload: "inference", rate: 4.80, reserved: 60, used: 50 },
    { machine: "M2 Pro · 32 GB",  workload: "sandbox",   rate: 0.40, reserved: 240, used: 195 },
    { machine: "M4 Max · 128 GB", workload: "inference", rate: 6.20, reserved: 90, used: 90 }
  ];

  var PHASE = { LOCK: 1200, RUN: 7600, SETTLE: 8500, HOLD: 12400 };

  var el = {};
  root.querySelectorAll("[data-meter]").forEach(function (node) {
    el[node.getAttribute("data-meter")] = node;
  });

  function usdc(n) {
    return n.toFixed(4);
  }

  function duration(minutes) {
    if (minutes < 60) return minutes + "m";
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return m ? h + "h " + m + "m" : h + "h";
  }

  // Deterministic pseudo-hash so a booking always stamps the same receipt.
  function txHash(seed) {
    var hex = "";
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (var j = 0; j < 8; j++) {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      hex += ((h >>> 0).toString(16) + "00000000").slice(0, 8);
    }
    return "0x" + hex.slice(0, 4) + "…" + hex.slice(-4);
  }

  function ledger(booking) {
    var locked = booking.rate * (booking.reserved / 60);
    var cost = booking.rate * (booking.used / 60);
    var fee = cost * COMMISSION;
    return {
      locked: locked,
      cost: cost,
      fee: fee,
      supplier: cost - fee,
      refund: locked - cost,
      supplierPct: locked ? ((cost - fee) / locked) * 100 : 0,
      feePct: locked ? (fee / locked) * 100 : 0
    };
  }

  var index = 0;
  var startedAt = null;
  var running = false;
  var frame = null;

  function paint(booking, sums, phase, progress) {
    var supplierW = 0, feeW = 0, heldW = 0, refundW = 0;
    var supplier = 0, fee = 0, refund = 0, locked = 0;
    var state = "idle";
    var phaseLabel = "awaiting escrow";
    var clock = "idle";
    var hash = "—";

    if (phase === "lock") {
      locked = sums.locked * progress;
      heldW = 100 * progress;
      state = "idle";
      phaseLabel = "locking escrow";
      clock = "open()";
    } else if (phase === "run") {
      locked = sums.locked;
      supplier = sums.supplier * progress;
      fee = sums.fee * progress;
      supplierW = sums.supplierPct * progress;
      feeW = sums.feePct * progress;
      heldW = 100 - supplierW - feeW;
      state = "open";
      phaseLabel = "running · billed to the second";
      clock = "t+" + duration(Math.max(1, Math.round(booking.used * progress)));
    } else {
      locked = sums.locked;
      supplier = sums.supplier;
      fee = sums.fee;
      refund = sums.refund;
      supplierW = sums.supplierPct;
      feeW = sums.feePct;
      refundW = 100 - supplierW - feeW;
      state = "settled";
      phaseLabel = sums.refund > 0
        ? "settled · " + duration(booking.used) + " of " + duration(booking.reserved)
        : "settled · full reservation used";
      clock = "settle()";
      hash = txHash(booking.machine + booking.used);
    }

    el.locked.textContent = usdc(locked);
    el.supplier.textContent = usdc(supplier);
    el.fee.textContent = usdc(fee);
    el.refund.textContent = usdc(refund);

    el["seg-supplier"].style.width = supplierW + "%";
    el["seg-fee"].style.width = feeW + "%";
    el["seg-held"].style.width = Math.max(0, heldW) + "%";
    el["seg-refund"].style.width = refundW + "%";

    el.clock.textContent = clock;
    el.phase.textContent = phaseLabel;
    el.hash.textContent = hash;
    el.receipt.setAttribute("data-state", state);
  }

  function header(booking) {
    el.machine.textContent = booking.machine;
    el.workload.textContent = booking.workload;
    el.rate.textContent = "$" + booking.rate.toFixed(2) + "/hr";
    el.reserved.textContent = duration(booking.reserved);
  }

  function tick(now) {
    if (!running) return;
    if (startedAt === null) startedAt = now;

    var booking = BOOKINGS[index];
    var sums = ledger(booking);
    var t = now - startedAt;

    if (t < PHASE.LOCK) {
      paint(booking, sums, "lock", t / PHASE.LOCK);
    } else if (t < PHASE.RUN) {
      paint(booking, sums, "run", (t - PHASE.LOCK) / (PHASE.RUN - PHASE.LOCK));
    } else if (t < PHASE.HOLD) {
      paint(booking, sums, "settle", 1);
    } else {
      index = (index + 1) % BOOKINGS.length;
      startedAt = now;
      header(BOOKINGS[index]);
    }

    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    startedAt = null;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  header(BOOKINGS[0]);

  if (reduced) {
    // No loop: show one fully settled booking so the story still reads.
    paint(BOOKINGS[0], ledger(BOOKINGS[0]), "settle", 1);
    return;
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0.2 }).observe(root);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : start();
  });
})();
