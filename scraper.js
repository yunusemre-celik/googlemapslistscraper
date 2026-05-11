/**
 * Google Maps İşletme Scraper
 * ─────────────────────────────────────────────────────────────────────────────
 * Çalıştır   : npm start   (veya SCRAPER BAŞLAT.bat'a çift tıkla)
 * Desteklenen URL tipleri:
 *   • Kayıtlı liste  : https://www.google.com/maps/placelists/...
 *   • Arama sonuçları: https://www.google.com/maps/search/restoran/...
 *   • Kısa link      : https://maps.app.goo.gl/...
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const OUTPUT_DIR = path.join(__dirname, 'cikti');
const DELAY_MS   = 1200;   // her yer arasında bekleme

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function timestamp() {
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}
function log(msg) { console.log(`[${timestamp()}] ${msg}`); }

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── Tek bir yer sayfasından bilgi kazı ──────────────────────────────────────
async function scrapePlace(page, placeUrl, placeName) {
  const result = { name: placeName, phone: '', website: '', address: '', category: '', url: placeUrl };
  try {
    // Maps asla tam "networkidle" olmaz — domcontentloaded yeterli, sonra bekle
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(DELAY_MS + 500);

    // İşletme adı
    const nameEl = await page.$('h1.DUwDvf');
    if (nameEl) result.name = (await nameEl.textContent()).trim();

    // Kategori
    const catEl = await page.$('button.DkEaL');
    if (catEl) result.category = (await catEl.textContent()).trim();

    // Adres
    const addrEl = await page.$('button[data-item-id="address"] .Io6YTe');
    if (addrEl) result.address = (await addrEl.textContent()).trim();

    // Telefon — birden fazla selector dene
    for (const sel of [
      'button[data-item-id^="phone:tel:"] .Io6YTe',
      'button[data-tooltip="Telefon numarasını kopyala"] .Io6YTe',
      'a[href^="tel:"]'
    ]) {
      const el = await page.$(sel);
      if (el) { result.phone = (await el.textContent()).trim().replace(/^tel:/, ''); break; }
    }

    // Web sitesi — birden fazla selector dene
    for (const sel of [
      'a[data-item-id="authority"] .Io6YTe',
      'a[data-item-id="authority"]',
      'a[href*="http"][aria-label*="Web"]',
    ]) {
      const el = await page.$(sel);
      if (el) {
        result.website = (await el.textContent()).trim() ||
                         (await el.getAttribute('href') || '').replace(/^https?:\/\//, '').split('/')[0];
        if (result.website) break;
      }
    }

    log(`  ✓ ${result.name} | 📞 ${result.phone || '-'} | 🌐 ${result.website || '-'}`);
  } catch (err) {
    log(`  ✗ Hata (${placeName}): ${err.message.split('\n')[0]}`);
  }
  return result;
}

// ─── Listedeki / arama sonuçlarındaki tüm yer linklerini topla ───────────────
async function getAllPlaceLinks(page) {
  log('  Yerler yükleniyor, sayfa aşağı kaydırılıyor...');

  // Sol sonuç panelini bul ve kaydır
  let prevCount = 0;
  let stuckRounds = 0;

  for (let i = 0; i < 80; i++) {
    const count = await page.evaluate(() => {
      // Olası panel seçiciler
      const panel =
        document.querySelector('div[role="feed"]') ||
        document.querySelector('.m6QErb[aria-label]') ||
        document.querySelector('.DxyBCb') ||
        document.querySelector('[role="main"] .m6QErb');

      if (panel) {
        panel.scrollTop += 3000;
        return document.querySelectorAll('a.hfpxzc').length;
      } else {
        window.scrollBy(0, 3000);
        return document.querySelectorAll('a.hfpxzc').length;
      }
    });

    await sleep(700);

    if (count === prevCount) {
      stuckRounds++;
      if (stuckRounds >= 4) break; // 4 tur aynı sayı → son sayfa
    } else {
      stuckRounds = 0;
    }
    prevCount = count;
  }

  // Tüm linkleri topla
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
      url: a.href,
      name: a.getAttribute('aria-label') || a.textContent.trim() || 'İşletme'
    })).filter(l => l.url)
  );

  log(`  ${links.length} yer bulundu.`);
  return links;
}

// ─── Sayfanın yüklenmesini bekle (Maps'e özel) ───────────────────────────────
async function waitForMapsPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    log(`  ⚠️  Yükleme süresi aşıldı, devam ediliyor... (${e.message.split('\n')[0]})`);
  }
  // Maps'in içeriği JS ile render eder, bekle
  await sleep(3500);

  // Sol panelin veya kart alanının çıkmasını bekle (max 15 sn)
  for (let i = 0; i < 15; i++) {
    const ready = await page.evaluate(() =>
      document.querySelectorAll('a.hfpxzc').length > 0 ||
      document.querySelector('h1.DUwDvf') !== null
    );
    if (ready) break;
    await sleep(1000);
  }
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Google Maps İşletme Scraper                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // URL al
  let listUrl = process.argv[2] || '';
  if (!listUrl) {
    console.log('  Desteklenen URL tipleri:');
    console.log('  • Kayıtlı liste  : https://www.google.com/maps/placelists/...');
    console.log('  • Arama sonuçları: https://www.google.com/maps/search/...');
    console.log('  • Kısa link      : https://maps.app.goo.gl/...\n');
    listUrl = await ask('▶ URL yapıştırın: ');
  }

  listUrl = listUrl.trim().replace(/^["']+|["']+$/g, '');

  const isValidUrl = listUrl.includes('google.com/maps') ||
                     listUrl.includes('maps.app.goo.gl') ||
                     listUrl.includes('goo.gl/maps');

  if (!isValidUrl) {
    console.error('❌ Geçersiz URL. Google Maps linki olmalı.');
    process.exit(1);
  }

  // Liste adı
  let listName = await ask('▶ Bu taranan yerler için bir isim girin (örn: Restoranlar): ');
  if (!listName) listName = 'İşletmeler';

  log(`\n🚀 Tarayıcı açılıyor...\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    viewport: null,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Sayfaya git
  log(`🔗 Açılıyor: ${listUrl}`);
  await waitForMapsPage(page, listUrl);

  const finalUrl = page.url();
  log(`📍 Yönlendirildi: ${finalUrl}`);

  // Giriş gerekiyorsa bekle
  if (finalUrl.includes('accounts.google.com') || finalUrl.includes('/signin')) {
    log('\n⚠️  Google hesabına giriş gerekiyor.');
    log('   Tarayıcıda giriş yapın, sonra terminale dönüp Enter\'a basın.\n');
    await ask('   [Giriş tamamlandı, Enter\'a basın] ');
    await waitForMapsPage(page, listUrl);
  }

  // Yer linklerini topla
  log(`\n🗂️  Taranıyor: "${listName}"`);
  const links = await getAllPlaceLinks(page);

  if (links.length === 0) {
    log('\n❌ Hiç yer bulunamadı!');
    log('   Olası nedenler:');
    log('   1. Sayfa düzgün yüklenmedi — tarayıcıda kontrol edin');
    log('   2. Giriş gerekiyor — tarayıcıda giriş yapıp tekrar deneyin');
    log('   3. Arama sonuçları boş');
    log('\n   Tarayıcı açık kalıyor, kontrol edebilirsiniz.');
    await ask('   [Kapatmak için Enter\'a basın] ');
    await browser.close();
    return;
  }

  // Her yeri ayrıntılı tara
  const allPlaces = [];
  for (let i = 0; i < links.length; i++) {
    log(`  [${i + 1}/${links.length}] ${links[i].name}`);
    const data = await scrapePlace(page, links[i].url, links[i].name);
    data.listName = listName;
    allPlaces.push(data);
  }

  log(`\n✅ Toplam ${allPlaces.length} yer toplandı. Kaydediliyor...`);
  saveHTML(allPlaces);

  log('\n🎉 Tamamlandı!');
  log('   📄 cikti/isletmeler.html  ← tarayıcıda açın');

  await browser.close();
}

// ─── HTML (satır görünümü + checkbox + not) ──────────────────────────────────
function saveHTML(places) {
  const byList = {};
  places.forEach(p => {
    const k = p.listName || 'Genel';
    if (!byList[k]) byList[k] = [];
    byList[k].push(p);
  });

  const statsTotal   = places.length;
  const statsPhone   = places.filter(p => p.phone).length;
  const statsWebsite = places.filter(p => p.website).length;
  const statsNoPhone = places.filter(p => !p.phone).length;

  const tabs = Object.keys(byList).map((name, i) =>
    `<button class="tab-btn${i===0?' active':''}" onclick="showTab(${i},this)">${esc(name)} <span class="badge">${byList[name].length}</span></button>`
  ).join('');

  let rowId = 0;
  const sections = Object.entries(byList).map(([, items], i) => {
    const rows = items.map(p => {
      const id = rowId++;
      const webHref = p.website ? (p.website.startsWith('http') ? p.website : 'https://'+p.website) : '';
      return `
<tr class="biz-row" data-id="${id}">
  <td class="col-check"><input type="checkbox" class="cb" data-id="${id}" onchange="saveCB(${id},this.checked)"></td>
  <td class="col-name">
    <span class="biz-name">${esc(p.name)}</span>
    ${p.category?`<span class="cat">${esc(p.category)}</span>`:''}
  </td>
  <td class="col-phone">${p.phone?`<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>`:''}</td>
  <td class="col-web">${p.website?`<a href="${esc(webHref)}" target="_blank">${esc(p.website)}</a>`:''}</td>
  <td class="col-addr">${esc(p.address)}</td>
  <td class="col-map"><a class="maps-btn" href="${esc(p.url)}" target="_blank">🗺️</a></td>
  <td class="col-note"><textarea class="note" rows="1" placeholder="Not ekle..." data-id="${id}" oninput="saveNote(${id},this.value)"></textarea></td>
</tr>`;
    }).join('');
    return `<section class="tab-panel${i===0?' active':''}" id="panel-${i}">
<table class="biz-table"><thead><tr>
  <th class="col-check"><input type="checkbox" title="Tümünü seç" onchange="toggleAll(this)"></th>
  <th class="col-name">İşletme Adı</th>
  <th class="col-phone">Telefon</th>
  <th class="col-web">Web Sitesi</th>
  <th class="col-addr">Adres</th>
  <th class="col-map">Harita</th>
  <th class="col-note">Not</th>
</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Maps İşletmeler — ${esc(places[0]?.listName||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1117;--bg2:#1a1d27;--bg3:#21253a;--border:rgba(255,255,255,0.08);--accent:#4f8ef7;--accent2:#7c5af5;--text:#e4e6f0;--dim:#8b8fa8}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.header{background:linear-gradient(135deg,#1a1d27,#12162a);border-bottom:1px solid var(--border);padding:24px 36px;display:flex;align-items:center;gap:14px}
.header h1{font-size:1.4rem;font-weight:700}
.header p{color:var(--dim);font-size:.8rem;margin-top:2px}
.stats{display:flex;gap:12px;flex-wrap:wrap;padding:14px 36px;background:var(--bg2);border-bottom:1px solid var(--border)}
.stat{background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:8px 14px;display:flex;align-items:center;gap:8px}
.sn{font-size:1.2rem;font-weight:700;color:var(--accent)}
.sl{font-size:.72rem;color:var(--dim);line-height:1.3}
.toolbar{display:flex;align-items:center;gap:12px;padding:12px 36px;background:var(--bg2);border-bottom:1px solid var(--border);flex-wrap:wrap}
#q{flex:1;min-width:220px;max-width:420px;background:var(--bg3);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:inherit;font-size:.86rem;padding:8px 13px;outline:none;transition:border-color .2s}
#q:focus{border-color:var(--accent)}
#q::placeholder{color:var(--dim)}
.chk-count{font-size:.8rem;color:var(--dim)}
.tabs{display:flex;gap:7px;flex-wrap:wrap;padding:14px 36px 0;background:var(--bg)}
.tab-btn{background:var(--bg2);border:1px solid var(--border);color:var(--dim);font-family:inherit;font-size:.8rem;padding:6px 13px;border-radius:7px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px}
.tab-btn:hover{border-color:var(--accent);color:var(--text)}
.tab-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.badge{background:rgba(255,255,255,.2);border-radius:20px;padding:1px 6px;font-size:.7rem}
.tab-panel{display:none;padding:18px 36px 40px;overflow-x:auto}
.tab-panel.active{display:block}
.biz-table{width:100%;border-collapse:collapse;font-size:.83rem}
.biz-table thead th{background:var(--bg2);color:var(--dim);font-weight:600;text-transform:uppercase;font-size:.7rem;letter-spacing:.04em;padding:10px 12px;border-bottom:2px solid var(--border);text-align:left;white-space:nowrap}
.biz-row{border-bottom:1px solid var(--border);transition:background .15s}
.biz-row:hover{background:rgba(255,255,255,.03)}
.biz-row.checked{background:rgba(79,142,247,.07)}
.biz-row.hidden{display:none}
.biz-table td{padding:10px 12px;vertical-align:middle}
.col-check{width:36px;text-align:center}
.col-check input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
.col-name{min-width:180px}
.biz-name{font-weight:600;display:block;margin-bottom:2px}
.cat{background:rgba(79,142,247,.12);color:var(--accent);border:1px solid rgba(79,142,247,.25);border-radius:5px;padding:1px 6px;font-size:.68rem}
.col-phone,.col-web{white-space:nowrap}
.col-phone a,.col-web a{color:var(--accent);text-decoration:none}
.col-phone a:hover,.col-web a:hover{text-decoration:underline}
.col-addr{max-width:220px;color:var(--dim);font-size:.8rem}
.col-map{text-align:center;width:48px}
.maps-btn{font-size:1.1rem;text-decoration:none;opacity:.8;transition:opacity .2s}
.maps-btn:hover{opacity:1}
.col-note{min-width:180px;max-width:260px}
.note{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text);font-family:inherit;font-size:.78rem;padding:5px 9px;resize:vertical;min-height:32px;outline:none;transition:border-color .2s}
.note:focus{border-color:var(--accent)}
.note::placeholder{color:var(--dim)}
footer{text-align:center;padding:18px;color:var(--dim);font-size:.75rem;border-top:1px solid var(--border)}
@media(max-width:700px){.header,.stats,.toolbar,.tabs,.tab-panel{padding-left:12px;padding-right:12px}}
</style>
</head>
<body>
<header class="header">
  <span style="font-size:2rem">🗺️</span>
  <div><h1>Google Maps İşletmeler</h1><p>Oluşturulma: ${timestamp()} · ${statsTotal} işletme</p></div>
</header>
<div class="stats">
  <div class="stat"><span class="sn">${statsTotal}</span><span class="sl">Toplam<br>İşletme</span></div>
  <div class="stat"><span class="sn" style="color:#34d399">${statsPhone}</span><span class="sl">Telefon<br>Numaralı</span></div>
  <div class="stat"><span class="sn" style="color:#f59e0b">${statsWebsite}</span><span class="sl">Web Siteli</span></div>
  <div class="stat"><span class="sn" style="color:#f87171">${statsNoPhone}</span><span class="sl">Telefon<br>Eksik</span></div>
</div>
<div class="toolbar">
  <input type="text" id="q" placeholder="🔍 İşletme adı, telefon veya adres ara..." oninput="filterRows(this.value)">
  <span class="chk-count" id="chk-count"></span>
</div>
<div class="tabs">${tabs}</div>
${sections}
<footer>Google Maps Scraper · ${statsTotal} işletme · ${timestamp()} · Notlar ve işaretler tarayıcıda otomatik kaydedilir</footer>
<script>
const KEY_CB='gmaps_cb_',KEY_NOTE='gmaps_note_';
window.addEventListener('load',()=>{
  document.querySelectorAll('.cb').forEach(cb=>{
    const v=localStorage.getItem(KEY_CB+cb.dataset.id);
    if(v==='1'){cb.checked=true;cb.closest('tr').classList.add('checked');}
  });
  document.querySelectorAll('.note').forEach(ta=>{
    const v=localStorage.getItem(KEY_NOTE+ta.dataset.id);
    if(v){ta.value=v;autoH(ta);}
  });
  updateCount();
});
function saveCB(id,v){
  localStorage.setItem(KEY_CB+id,v?'1':'0');
  document.querySelector(`.cb[data-id="${id}"]`).closest('tr').classList.toggle('checked',v);
  updateCount();
}
function saveNote(id,v){
  localStorage.setItem(KEY_NOTE+id,v);
  const ta=document.querySelector(`.note[data-id="${id}"]`);
  autoH(ta);
}
function autoH(ta){ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
function updateCount(){
  const total=document.querySelectorAll('.cb').length;
  const checked=document.querySelectorAll('.cb:checked').length;
  document.getElementById('chk-count').textContent=checked>0?checked+' / '+total+' işaretlendi':'';
}
function toggleAll(master){
  const panel=master.closest('.tab-panel');
  panel.querySelectorAll('.cb').forEach(cb=>{
    cb.checked=master.checked;
    saveCB(cb.dataset.id,master.checked);
  });
}
function showTab(i,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+i).classList.add('active');
  btn.classList.add('active');
  filterRows(document.getElementById('q').value);
}
function filterRows(q){
  q=q.toLowerCase().trim();
  const searching=q.length>0;
  if(searching) document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('active'));
  document.querySelectorAll('.biz-row').forEach(r=>{
    r.classList.toggle('hidden',searching&&!r.textContent.toLowerCase().includes(q));
  });
}
</script>
</body></html>`;

  const out = path.join(OUTPUT_DIR, 'isletmeler.html');
  fs.writeFileSync(out, html, 'utf8');
  log(`📄 HTML: ${out}`);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

main().catch(err => {
  console.error('\n❌ Kritik hata:', err.message);
  process.exit(1);
});
