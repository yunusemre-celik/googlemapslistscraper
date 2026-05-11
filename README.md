# Google Maps İşletme Scraper 🗺️

Google Maps'teki **arama sonuçları**, **kayıtlı liste** veya **kısa link** üzerinden işletmelerin adını, telefon numarasını, web sitesini ve adresini otomatik olarak toplar. Çıktıyı interaktif bir HTML tablosuna dönüştürür.

---

## ✨ Özellikler

- 🔗 Her türlü Google Maps URL'ini destekler
- 📋 İşletme adı, kategori, telefon, web sitesi, adres toplar
- 📄 Satır görünümlü HTML raporu üretir
- ☑️ Her satırda checkbox ile işaretleme
- 📝 Tarayıcıda otomatik kaydedilen not alanı
- 🔍 Anlık arama/filtreleme
- 🖱️ Çift tıkla çalıştır (`.bat` kısayolu)

---

## 🚀 Kurulum

**Gereksinimler:** [Node.js](https://nodejs.org) (v16+)

```bash
# Bağımlılıkları yükle
npm install

# Playwright tarayıcısını indir (sadece ilk kurulumda)
npx playwright install chromium
```

---

## 🖥️ Kullanım

### Yöntem 1 — Çift Tıkla (Kolay)
`SCRAPER BAŞLAT.bat` dosyasına çift tıklayın.

### Yöntem 2 — Terminal
```bash
npm start
```

### Yöntem 3 — URL Argümanıyla
```bash
node scraper.js "https://www.google.com/maps/search/restoran/@..."
```

---

## 📌 Desteklenen URL Tipleri

| Tip | Örnek |
|-----|-------|
| Arama sonuçları | `https://www.google.com/maps/search/restoran/...` |
| Kayıtlı liste | `https://www.google.com/maps/placelists/...` |
| Kısa link | `https://maps.app.goo.gl/...` |

---

## 📁 Proje Yapısı

```
google-kaydedilen-scraper/
├── scraper.js          ← Ana scraper kodu
├── SCRAPER BAŞLAT.bat  ← Windows kısayolu
├── package.json
├── README.md
└── cikti/              ← Çıktılar (Git'e eklenmez)
    └── isletmeler.html
```

---

## ⚙️ Çalışma Akışı

```
URL gir → Tarayıcı açılır → Sayfa yüklenir → İşletmeler listelenir
→ Her işletme tek tek ziyaret edilir → HTML rapor oluşur
```

Eğer sayfa giriş gerektiriyorsa:
1. Tarayıcıda Google hesabınıza giriş yapın
2. Terminalde **Enter**'a basın → scraper devam eder

---

## 📊 HTML Çıktısı

| Sütun | İçerik |
|-------|--------|
| ☑ | İşaretleme kutusu (localStorage'da saklanır) |
| İşletme Adı | Ad + kategori etiketi |
| Telefon | Tıklanabilir `tel:` linki |
| Web Sitesi | Tıklanabilir URL |
| Adres | Düz metin |
| Harita | Google Maps'te aç |
| Not | Otomatik kaydedilen not alanı |

---

## ⚠️ Notlar

- Google Maps'in HTML yapısı zaman zaman değişebilir; bu durumda CSS seçicileri güncellenebilir
- Çok fazla istek atmamak için her işletme arasında ~1.2 saniye beklenir
- Scraper tamamen **ücretsizdir**, hiçbir API anahtarı gerektirmez

---

## 📄 Lisans

MIT
