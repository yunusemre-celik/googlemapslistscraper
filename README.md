# Google Maps Business Scraper 🗺️

Automatically collects business names, phone numbers, websites, and addresses from any Google Maps **search result**, **saved list**, or **short link**. Outputs an interactive HTML report.

---

## ✨ Features

- 🔗 Supports any Google Maps URL type
- 📋 Collects name, category, phone, website, and address
- 📄 Generates a clean row-based HTML report
- ☑️ Checkbox per row for tracking
- 📝 Persistent notes field (saved in browser localStorage)
- 🔍 Instant search / filter across all columns
- 🖱️ One-click launcher (`.bat` shortcut for Windows)

---

## 🚀 Setup

**Requirements:** [Node.js](https://nodejs.org) v16+

```bash
# Install dependencies
npm install

# Download Playwright browser (first time only)
npx playwright install chromium
```

---

## 🖥️ Usage

### Option 1 — Double Click (Easiest)
Double-click `SCRAPER BAŞLAT.bat`.

### Option 2 — Terminal
```bash
npm start
```

### Option 3 — Pass URL directly
```bash
node scraper.js "https://www.google.com/maps/search/restaurant/@..."
```

---

## 📌 Supported URL Types

| Type | Example |
|------|---------|
| Search results | `https://www.google.com/maps/search/restaurant/...` |
| Saved list | `https://www.google.com/maps/placelists/...` |
| Short link | `https://maps.app.goo.gl/...` |

---

## 📁 Project Structure

```
google-maps-scraper/
├── scraper.js          ← Main scraper script
├── SCRAPER BAŞLAT.bat  ← Windows launcher shortcut
├── package.json
├── README.md
└── cikti/              ← Output folder (excluded from Git)
    └── isletmeler.html
```

---

## ⚙️ How It Works

```
Paste URL → Browser opens → Page loads → Businesses are listed
→ Each business is visited individually → HTML report is saved
```

If the page requires a Google login:
1. Sign in to your Google account in the opened browser
2. Press **Enter** in the terminal → scraper continues automatically

---

## 📊 HTML Output Columns

| Column | Description |
|--------|-------------|
| ☑ | Checkbox for tracking (persisted in localStorage) |
| Business Name | Name + category badge |
| Phone | Clickable `tel:` link |
| Website | Clickable URL |
| Address | Plain text |
| Map | Opens in Google Maps |
| Notes | Auto-saved note field |

---

## ⚠️ Notes

- Google Maps' HTML structure may change over time; CSS selectors may need updating if that happens
- A ~1.2 second delay is added between each business request to avoid rate limiting
- Completely **free** — no API key required

---

## 📄 License

MIT
