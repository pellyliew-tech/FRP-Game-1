
# Christmas Campaign Leaderboard

## 🚨 IMPORTANT: How to Deploy Correctly

If you are seeing a **404 Error** or **"Could not read package.json"** on Netlify, you likely uploaded your files incorrectly.

### ❌ Do NOT upload the folder
If your GitHub repo looks like this, it is **WRONG**:
- `My-Repo-Name/`
  - `My-Code-Folder/` 📁
    - `index.html` 📄
    - `package.json` 📄

### ✅ DO upload the files
Your GitHub repo must look like this (Files at the top):
- `My-Repo-Name/`
  - `index.html` 📄
  - `package.json` 📄
  - `src/` 📁
  - `vite.config.ts` 📄

---

## 💻 How to run on your computer (for developers)

1.  **Install Node.js**: Download and install from [nodejs.org](https://nodejs.org/).
2.  **Open Terminal**: Open the folder in VS Code or Terminal.
3.  **Install**: Run `npm install`.
4.  **Start**: Run `npm run dev`.
5.  **Open**: Go to `http://localhost:5173`.

## ⚠️ Why is my screen blank when I open index.html?

You **cannot** double-click `index.html` to open this website.
This is a modern React application. It requires a "Build" step to turn the code into a website.

**To view the site, you must either:**
1.  Run it using the steps above (`npm run dev`).
2.  Deploy it to Netlify (Cloud).
