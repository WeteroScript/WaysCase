import { useEffect, useMemo, useState } from "react";

type Gift = {
  id: string;
  name: string;
  stars: number;
  premium: boolean;
  limited?: boolean;
  remaining?: number;
  total?: number;
  upgradeStars?: number;
  emoji?: string;
  imageUrl?: string;
  stickerFormat?: string;
};

type ApiResponse = { gifts: Gift[]; source: string; updatedAt: string };

function App() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "limited" | "premium">("all");
  const [selected, setSelected] = useState<Gift | null>(null);
  const [tab, setTab] = useState<"catalog" | "about">("catalog");

  async function loadGifts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gifts");
      if (!response.ok) throw new Error("API returned " + response.status);
      const data = (await response.json()) as ApiResponse;
      setGifts(data.gifts || []);
    } catch {
      setError("Не удалось получить каталог Telegram. Проверь, что API WaysCase запущен и BOT_TOKEN задан на сервере.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadGifts(); }, []);

  const visibleGifts = useMemo(() => gifts.filter((gift) => {
    const matchesQuery = (gift.name + " " + gift.id).toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "limited" ? gift.limited : gift.premium);
    return matchesQuery && matchesFilter;
  }), [gifts, query, filter]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="WaysCase home">
          <span className="brand-mark">W</span>
          <span className="brand-name">WaysCase<small>TELEGRAM GIFT CATALOG</small></span>
        </a>
        <span className="live-status"><i /> TELEGRAM DATA</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OFFICIAL TELEGRAM GIFTS</p>
          <h1>Коллекция начинается<br /><span>с настоящего подарка.</span></h1>
          <p>Каталог подарков Telegram с официальными изображениями, идентификаторами и доступными характеристиками.</p>
          <button className="hero-button" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>Открыть каталог <b>↘</b></button>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="gift-orbit orbit-a" /><div className="gift-orbit orbit-b" /><div className="hero-gift">✦</div><span className="spark spark-a">✧</span><span className="spark spark-b">✦</span></div>
      </section>

      <nav className="main-nav">
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>Каталог подарков</button>
        <button className={tab === "about" ? "active" : ""} onClick={() => setTab("about")}>О WaysCase</button>
      </nav>

      {tab === "catalog" ? (
        <section className="catalog" id="catalog">
          <div className="section-title">
            <div><p className="eyebrow">LIVE CATALOG</p><h2>Telegram Gifts <sup>{gifts.length}</sup></h2></div>
            <button className="refresh" onClick={() => void loadGifts()} disabled={loading}>↻ Обновить</button>
          </div>
          <div className="toolbar">
            <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти по ID..." /></label>
            <div className="filters">
              <button className={filter === "all" ? "chosen" : ""} onClick={() => setFilter("all")}>Все</button>
              <button className={filter === "limited" ? "chosen" : ""} onClick={() => setFilter("limited")}>Лимитированные</button>
              <button className={filter === "premium" ? "chosen" : ""} onClick={() => setFilter("premium")}>Premium</button>
            </div>
          </div>

          {loading ? <div className="state-panel"><div className="loader" /><h3>Загружаем подарки Telegram</h3><p>Получаем актуальный список из Bot API.</p></div> :
            error ? <div className="state-panel error-panel"><span>!</span><h3>Каталог пока недоступен</h3><p>{error}</p><button className="hero-button" onClick={() => void loadGifts()}>Повторить</button></div> :
            visibleGifts.length ? <div className="gift-grid">{visibleGifts.map((gift) => (
              <button className="gift-card" key={gift.id} onClick={() => setSelected(gift)}>
                <div className="gift-image">{gift.imageUrl ? <img src={gift.imageUrl} alt={gift.name} loading="lazy" /> : <span>{gift.emoji || "✦"}</span>}<i>TELEGRAM GIFT</i></div>
                <div className="gift-details"><h3>{gift.name}</h3><small className="gift-id">ID {gift.id}</small><div className="gift-tags">{gift.limited && <span className="tag limited">LIMITED</span>}{gift.premium && <span className="tag premium">PREMIUM</span>}</div><p>{gift.stars.toLocaleString("ru-RU")} <span>★ Stars</span></p></div>
                <span className="card-arrow">↗</span>
              </button>
            ))}</div> : <div className="state-panel"><h3>Ничего не найдено</h3><p>Измени поисковый запрос или фильтр.</p></div>
          }
        </section>
      ) : (
        <section className="about-panel"><p className="eyebrow">ABOUT THE PROJECT</p><h2>Только настоящие Telegram Gifts.</h2><p>WaysCase показывает данные, полученные из официального Telegram Bot API. Названия, стоимость отправки в Stars, лимиты и изображения не придумываются вручную.</p><div className="about-points"><div><b>01</b><span>Официальный источник данных</span></div><div><b>02</b><span>Никаких выдуманных коллекций</span></div><div><b>03</b><span>Просмотр без ставок и случайных платных наград</span></div></div><p className="disclaimer">Важно: getAvailableGifts возвращает подарки, доступные для отправки ботом. Это не полный список уникальных коллекционных NFT и не подтверждение владения подарком конкретным пользователем.</p></section>
      )}

      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="gift-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelected(null)}>×</button>
        <div className="modal-image">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} /> : <span>{selected.emoji || "✦"}</span>}</div>
        <p className="eyebrow">OFFICIAL TELEGRAM GIFT</p><h2>{selected.name}</h2>
        <div className="detail-rows"><div><span>Идентификатор</span><b className="gift-id-value">{selected.id}</b></div><div><span>Отправка</span><b>{selected.stars.toLocaleString("ru-RU")} ★ Stars</b></div>
          {selected.limited && <div><span>Остаток</span><b>{selected.remaining ?? "—"} / {selected.total ?? "—"}</b></div>}
          {selected.upgradeStars && <div><span>Upgrade</span><b>{selected.upgradeStars.toLocaleString("ru-RU")} ★ Stars</b></div>}
          <div><span>Premium only</span><b>{selected.premium ? "Да" : "Нет"}</b></div>
        </div>
        <p className="modal-note">Информация получена из Telegram Bot API. Цена указана Telegram в Stars и не является ценой NFT на вторичном рынке.</p>
      </section></div>}
      <footer><b>WAYSCASE</b><span>TELEGRAM GIFTS CATALOG</span><a href="https://core.telegram.org/bots/api#available-gifts" target="_blank" rel="noreferrer">Источник: Telegram Bot API ↗</a></footer>
    </main>
  );
}
export default App;
