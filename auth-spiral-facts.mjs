// Illustrations and measurements are fetched only for an exploration session.
export function planetCards(dialog, onClose) {
  const field = (name) => dialog.querySelector("[data-fact-" + name + "]");
  const image = field("image"),
    portrait = image.parentElement;
  const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
  const au = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 5 });
  let catalog,
    current,
    generation = 0;
  function load() {
    if (!catalog)
      catalog = fetch("data/auth-planets/catalog.json?v=1")
        .then((response) => {
          if (!response.ok) throw Error("catalog");
          return response.json();
        })
        .catch((error) => {
          catalog = null;
          throw error;
        });
    return catalog;
  }
  const warm = () => {
    load().catch(() => {});
  };
  image.addEventListener("error", () => {
    image.hidden = true;
    portrait.classList.add("no-image");
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", "Minh họa " + (current?.name || ""));
    field("credit").hidden = true;
  });
  async function display() {
    const token = ++generation;
    field("content").hidden = true;
    field("retry").hidden = true;
    field("status").textContent = "Đang tải thông tin…";
    try {
      const { planets, sources } = await load();
      if (token !== generation || !dialog.open) return;
      const body = planets[current.id],
        solar = body.system === "sol";
      const put = (name, value) => {
        field(name).textContent = value;
      };
      put("summary", body.summary);
      put("feature", body.feature);
      put("distance-label", solar ? "Cách Mặt Trời trung bình" : "Cách sao TRAPPIST-1 trung bình");
      put("distance", au.format(body.distanceAu) + " AU");
      field("distance").title = "AU là đơn vị thiên văn, khoảng 149,6 triệu km.";
      put("diameter-label", solar ? "Đường kính trung bình" : "Đường kính ước tính");
      put("diameter", number.format(body.diameterKm) + " km");
      put("period", number.format(body.periodDays) + " ngày");
      put("credit", body.imageCredit);
      field("credit").href = body.imageSource;
      field("source").href = body.source;
      field("numbers").href = solar ? sources.distances : sources.exoplanets;
      field("physical").hidden = !solar;
      field("physical").href = sources.physical;
      portrait.classList.remove("no-image");
      portrait.removeAttribute("role");
      portrait.removeAttribute("aria-label");
      image.hidden = false;
      field("credit").hidden = false;
      image.alt = (solar ? "Ảnh " : "Tranh minh họa ") + body.name;
      image.src = body.image;
      field("status").textContent = "";
      field("content").hidden = false;
    } catch {
      if (token !== generation || !dialog.open) return;
      field("status").textContent = "Chưa tải được hồ sơ hành tinh. Kiểm tra kết nối rồi thử lại.";
      field("retry").hidden = false;
    }
  }
  function open(body, system) {
    current = body;
    dialog.querySelector("h2").textContent = body.name;
    field("system").textContent = system.name;
    portrait.style.setProperty("--body-color", body.color);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    display();
  }
  function finishClose() {
    ++generation;
    const last = current;
    current = null;
    if (last) onClose(last.id);
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    // Restore in the input event. The native close event is queued and could
    // otherwise steal focus after the user has already selected another body.
    finishClose();
  }
  field("close").addEventListener("click", close);
  field("retry").addEventListener("click", display);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open && current) finishClose();
  });
  return { open, close, warm };
}
