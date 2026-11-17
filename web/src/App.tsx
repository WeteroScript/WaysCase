import { useEffect, useMemo, useState } from "react";

type Tab = "cases" | "crash" | "upgrade" | "inventory" | "profile";
type Gift = { id: string; name: string; collection: string; edition: string; rarity: string; symbol: string; tone: string };
type Collection = { id: string; name: string; subtitle: string; symbol: string; tone: string; rarity: string; gifts: string[] };

const collections: Collection[] = [
  { id:"aurora",name:"Aurora Bloom",subtitle:"Свет северного сияния",symbol:"✿",tone:"rose",rarity:"Rare",gifts:["Aurora Petal","Northern Lily","Dawn Orchid","Prism Bud"] },
  { id:"moon",name:"Moon Capsule",subtitle:"Артефакты лунной станции",symbol:"☾",tone:"violet",rarity:"Epic",gifts:["Moon Rabbit","Lunar Beacon","Orbit Charm","Dust Satellite","Eclipse Core"] },
  { id:"royal",name:"Royal Icons",subtitle:"Знаки цифровой короны",symbol:"♛",tone:"gold",rarity:"Legendary",gifts:["Pixel Crown","Royal Seal","Golden Mantle","Sovereign Star"] },
  { id:"ocean",name:"Deep Ocean",subtitle:"Редкости из глубины",symbol:"◈",tone:"blue",rarity:"Epic",gifts:["Abyss Pearl","Tidal Shell","Blue Current","Coral Memory","Ocean Prism"] },
  { id:"meadow",name:"Dream Meadow",subtitle:"Тихая коллекция природы",symbol:"❀",tone:"mint",rarity:"Rare",gifts:["Clover Sprite","Velvet Fern","Dewdrop","Meadow Bell"] },
  { id:"neon",name:"Neon District",subtitle:"Ночная энергия города",symbol:"⌁",tone:"pink",rarity:"Epic",gifts:["Neon Heart","Pulse Tag","Afterglow","Night Signal","Ultraviolet"] },
  { id:"cosmos",name:"Cosmic Relics",subtitle:"Осколки далёких галактик",symbol:"✧",tone:"indigo",rarity:"Legendary",gifts:["Nova Fragment","Star Map","Comet Trail","Galaxy Key"] },
  { id:"porcelain",name:"Porcelain Club",subtitle:"Коллекционные миниатюры",symbol:"◇",tone:"ivory",rarity:"Rare",gifts:["Ivory Swan","Ceramic Fox","Blue Teacup","Pearl Button"] },
  { id:"arcade",name:"Arcade Spirits",subtitle:"Пиксельные талисманы",symbol:"▣",tone:"orange",rarity:"Epic",gifts:["8-Bit Tiger","Bonus Coin","Pixel Comet","Lucky Console","Glitch Cat"] },
  { id:"celestial",name:"Celestial Pets",subtitle:"Спутники звёздных миров",symbol:"✦",tone:"cyan",rarity:"Legendary",gifts:["Solar Dragon","Cloud Whale","Stardust Owl","Orbit Fox"] },
];

const seed: Gift[] = [
  {id:"g1",name:"Aurora Petal",collection:"Aurora Bloom",edition:"#024",rarity:"Rare",symbol:"✿",tone:"rose"},
  {id:"g2",name:"Moon Rabbit",collection:"Moon Capsule",edition:"#008",rarity:"Epic",symbol:"☾",tone:"violet"},
  {id:"g3",name:"Pixel Crown",collection:"Royal Icons",edition:"#003",rarity:"Legendary",symbol:"♛",tone:"gold"},
  {id:"g4",name:"Abyss Pearl",collection:"Deep Ocean",edition:"#041",rarity:"Epic",symbol:"◈",tone:"blue"},
];

const tabs: {id:Tab;label:string;icon:string}[] = [
  {id:"cases",label:"Cases",icon:"▦"},{id:"crash",label:"Crash",icon:"↗"},
  {id:"upgrade",label:"Upgrade",icon:"✧"},{id:"inventory",label:"Инвентарь",icon:"▤"},{id:"profile",label:"Профиль",icon:"◉"},
];

function Art({symbol,tone,large=false}:{symbol:string;tone:string;large?:boolean}) {
  return <div className={`art tone-${tone} ${large?"large":""}`}><i className="orbit one"/><i className="orbit two"/><b>{symbol}</b><small>✦</small></div>;
}

function App() {
  const [tab,setTab] = useState<Tab>("cases");
  const [collection,setCollection] = useState<Collection|null>(null);
  const [inventory] = useState<Gift[]>(()=>{
    try { const v=localStorage.getItem("wayscase-inventory"); return v?JSON.parse(v) as Gift[]:seed; } catch { return seed; }
  });
  const [points,setPoints] = useState(()=>Number(localStorage.getItem("wayscase-points")||0));
  const [claimed,setClaimed] = useState(()=>localStorage.getItem("wayscase-claimed")==="yes");
  const [flying,setFlying] = useState(false);
  const [flightDone,setFlightDone] = useState(false);
  const [giftId,setGiftId] = useState("g1");
  const [model,setModel] = useState("Aurora Petal · Collectible");
  const [preview,setPreview] = useState(false);
  const user=window.Telegram?.WebApp?.initDataUnsafe?.user;
  const name=user?.first_name||user?.username||"Коллекционер";
  const currentGift=useMemo(()=>inventory.find(g=>g.id===giftId)||inventory[0],[inventory,giftId]);

  useEffect(()=>{localStorage.setItem("wayscase-inventory",JSON.stringify(inventory));},[inventory]);
  useEffect(()=>{localStorage.setItem("wayscase-points",String(points));},[points]);

  function claimDemo() {
    if(claimed)return;
    setPoints(v=>v+100000);setClaimed(true);localStorage.setItem("wayscase-claimed","yes");
  }
  function launchFlight() {
    if(flying)return;
    setFlying(true);setFlightDone(false);
    window.setTimeout(()=>{setFlying(false);setFlightDone(true);},4300);
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><div className="brand-icon">W</div><div><strong>ways<span>case</span></strong><small>NFT GIFTS CLUB</small></div></div>
      <div className="top-actions"><span className="demo-tag"><i/>DEMO</span><button className="avatar" onClick={()=>setTab("profile")}>{name.slice(0,1).toUpperCase()}</button></div>
    </header>

    <section className="hero">
      <div><p className="eyebrow">ЦИФРОВЫЕ КОЛЛЕКЦИИ</p><h1>Твоя полка<br/><span>уникальных подарков.</span></h1><p className="hero-copy">Исследуй коллекции, изучай модели и собирай собственную витрину.</p></div>
      <div className="hero-seal"><span>✧</span><b>W</b></div>
    </section>

    <section className="stats">
      <div><i>▤</i><strong>{inventory.length}</strong><small>в коллекции</small></div><hr/>
      <div><i>✦</i><strong>{collections.length}</strong><small>каталогов</small></div><hr/>
      <div><i>◈</i><strong>{points.toLocaleString("ru-RU")}</strong><small>демо-баллы</small></div>
    </section>

    <div className="content">
      {tab==="cases"&&<section>
        <div className="section-head"><div><p className="eyebrow">CURATED COLLECTIONS</p><h2>Cases <sup>10</sup></h2></div><small>Фиксированный состав</small></div>
        <div className="collections">{collections.map((c,i)=><article className="collection-card" key={c.id}>
          <div className="case-art"><span className="case-number">0{i+1}</span><Art symbol={c.symbol} tone={c.tone} large/><span className={`rarity ${c.rarity.toLowerCase()}`}>{c.rarity}</span></div>
          <div className="case-info"><h3>{c.name}</h3><p>{c.subtitle}</p><div className="case-meta">{c.gifts.length} предмета <span>·</span> каталог</div><button className="link-btn" onClick={()=>setCollection(c)}>Смотреть состав <b>↗</b></button></div>
        </article>)}</div>
        {collection&&<div className="backdrop" onClick={()=>setCollection(null)}><section className="modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
          <button className="close" onClick={()=>setCollection(null)}>×</button><Art symbol={collection.symbol} tone={collection.tone} large/><p className="eyebrow">COLLECTION CONTENTS</p><h2>{collection.name}</h2><p className="modal-copy">{collection.subtitle}. Все элементы состава показаны заранее.</p>
          <div className="gift-list">{collection.gifts.map((gift,i)=><div key={gift}><small>0{i+1}</small><b>{gift}</b><span>NFT GIFT</span></div>)}</div><p className="fine-print">Каталог для просмотра: без случайной выдачи и платежей.</p>
        </section></div>}
      </section>}

      {tab==="crash"&&<section><div className="section-head"><div><p className="eyebrow">MOTION SHOWROOM</p><h2>Flight <sup>01</sup></h2></div><small>Анимационная сцена</small></div>
        <div className={`flight-card ${flying?"flying":""} ${flightDone?"landed":""}`}><div className="starscape">✦　 ·　 ✧　　·　✦　　·</div><div className="flight-text"><small>WAYSCASE / ORBIT 001</small><h3>{flightDone?"Орбита достигнута":flying?"Подарок в пути":"Коллекция выходит на орбиту"}</h3><p>Запусти демонстрационную анимацию полёта NFT-подарка.</p></div>
          <div className="space-scene"><i className="planet"/><i className="planet tiny"/><div className="rocket">◆<b>✦</b></div><i className="trail"/></div>
          <div className="flight-bottom"><small>АНИМАЦИЯ · БЕЗ СТАВОК И НАГРАД</small><button className="primary" disabled={flying} onClick={launchFlight}>{flying?"ПОЛЁТ...":"Запустить полёт"} <b>↗</b></button></div>
        </div><div className="notice"><b>i</b><p>Это визуальная сцена: нет раунда, множителя, ставок, проигрыша или вывода выигрыша.</p></div>
      </section>}

      {tab==="upgrade"&&<section><div className="section-head"><div><p className="eyebrow">COLLECTOR WORKSHOP</p><h2>Upgrade <sup>02</sup></h2></div><small>Предпросмотр моделей</small></div>
        <div className="workshop"><div className="workshop-head"><div><small>MODEL LAB / 2026</small><h3>Сравни версии<br/>своего подарка.</h3><p>Выбери предмет из инвентаря и посмотри, как выглядит его коллекционная модель.</p></div><b>✧</b></div>
          <div className="pickers"><label>ТВОЙ ПОДАРОК<select value={giftId} onChange={e=>{setGiftId(e.target.value);setPreview(false);}}>{inventory.map(g=><option value={g.id} key={g.id}>{g.name} · {g.edition}</option>)}</select></label><span>＋</span><label>ВЕРСИЯ ДЛЯ ПРОСМОТРА<select value={model} onChange={e=>{setModel(e.target.value);setPreview(false);}}><option>Aurora Petal · Collectible</option><option>Moon Rabbit · Model</option><option>Pixel Crown · Collectible</option><option>Abyss Pearl · Model</option></select></label></div>
          <div className="preview"><div><Art symbol={currentGift?.symbol||"✧"} tone={currentGift?.tone||"violet"}/><small>ТЕКУЩИЙ ПРЕДМЕТ</small><b>{currentGift?.name||"Нет предметов"}</b><i>{currentGift?.edition||"—"}</i></div><span>→</span><div><Art symbol="✧" tone="gold"/><small>МОДЕЛЬ</small><b>{model.split(" · ")[0]}</b><i>{model.split(" · ")[1]}</i></div></div>
          <button className="primary wide" onClick={()=>setPreview(true)}>Сравнить модели <b>↗</b></button>{preview&&<p className="success">Предпросмотр готов. Оригинал и инвентарь не изменены.</p>}
        </div>
      </section>}

      {tab==="inventory"&&<section><div className="section-head"><div><p className="eyebrow">YOUR DIGITAL SHELF</p><h2>Инвентарь <sup>{inventory.length}</sup></h2></div><small>Мои подарки</small></div>
        {inventory.length?<div className="inventory">{inventory.map(g=><article key={g.id}><Art symbol={g.symbol} tone={g.tone} large/><div><span className={`rarity ${g.rarity.toLowerCase()}`}>{g.rarity}</span><h3>{g.name}</h3><p>{g.collection}</p><small>{g.edition}</small></div></article>)}</div>:<div className="empty"><b>◇</b><h3>Полка пока пуста</h3><p>Открой каталог и изучи доступные коллекции.</p><button className="link-btn" onClick={()=>setTab("cases")}>Перейти в Cases ↗</button></div>}
        <div className="notice"><b>◇</b><p>Демо-инвентарь хранится в этом браузере. Он не подтверждает владение реальным Telegram Gift или TON NFT.</p></div>
      </section>}

      {tab==="profile"&&<section><div className="section-head"><div><p className="eyebrow">COLLECTOR ACCOUNT</p><h2>Профиль</h2></div><small>Личный кабинет</small></div>
        <div className="profile"><div className="profile-user"><div className="profile-avatar">{name.slice(0,1).toUpperCase()}</div><div><small>COLLECTOR</small><h3>{name}</h3><p>{user?.username?"@"+user.username:"WaysCase member"}</p></div><b>✦</b></div>
          <div className="profile-stats"><div><b>{inventory.length}</b><small>Подарков</small></div><div><b>10</b><small>Коллекций</small></div><div><b>{inventory.filter(g=>g.rarity==="Legendary").length}</b><small>Legendary</small></div></div>
        </div>
        <div className="demo-card"><small className="eyebrow">SANDBOX ONLY</small><h3>Демо-баллы</h3><p>Тестовый счёт для проверки интерфейса. Не Stars и не TON.</p><strong>{points.toLocaleString("ru-RU")}</strong><button className="primary wide" disabled={claimed} onClick={claimDemo}>{claimed?"Бонус уже получен":"Получить 100 000 демо-баллов"}</button><small>Одно начисление в этом браузере. Баллы нельзя купить, передать или вывести.</small></div>
        <div className="profile-links"><button onClick={()=>setTab("inventory")}>▤　Мой инвентарь <span>↗</span></button><button onClick={()=>setTab("cases")}>▦　Каталог коллекций <span>↗</span></button><button onClick={()=>setTab("upgrade")}>✧　Мастерская моделей <span>↗</span></button></div>
      </section>}
    </div>

    <nav className="bottom-nav">{tabs.map(t=><button key={t.id} className={tab===t.id?"selected":""} onClick={()=>{setTab(t.id);setCollection(null);}}><b>{t.icon}</b><small>{t.label}</small></button>)}</nav>
    <footer>WAYSCASE <span>·</span> NFT GIFTS SHOWCASE <span>·</span> DEMO MODE</footer>
  </main>;
}
export default App;
