# BigQuery Release Notes Broadcaster

A premium web application built with a **Python Flask** backend and a plain vanilla **HTML, JavaScript, and CSS** frontend. It fetches Google Cloud's BigQuery release notes XML feed, dynamically parses them into independent updates, and allows users to broadcast them directly to X (formerly Twitter) using customized templates.

---

## ⚡ Key Features

*   **Granular Update Extractor:** Google Cloud groups daily release updates together in the Atom feed. The application parses the HTML body and isolates individual features, announcements, deprecations, and issues into individual, readable cards.
*   **Dual-Theme Glassmorphic UI:** Features a sleek, modern visual design with translucent panels, glow shadows, clear category badges, and a dark/light mode toggle.
*   **Tweet Composer Sidebar:** Integrates a sticky composer with templates and automatic truncation, keeping drafts under the 280-character Twitter limit.
*   **Twitter character counting logic:** Substitutes links with a static 23-character equivalent matching Twitter/X shortener calculations.
*   **In-Memory API Cache:** Caches parsed release lists for up to 10 minutes to minimize network payload limits and keep responses fast.

---

## 📁 Project Structure

```
bq-releases-notes/
├── templates/
│   └── index.html      # Main page HTML layout
├── static/
│   ├── css/
│   │   └── style.css   # Fluid layouts, variables, and dark/light themes
│   └── js/
│       └── app.js      # App controller (filtering, state, composer engine)
├── app.py              # Flask server, Atom feed scraper, and cache engine
├── requirements.txt    # Declared project dependencies (Flask, requests, bs4)
├── .gitignore          # File exclusions for Git
└── README.md           # Documentation (this file)
```

---

## 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kamschew/antigravity-event-talks-app.git
    cd antigravity-event-talks-app
    ```

2.  **Initialize a virtual environment:**
    ```bash
    python -m venv .venv
    ```

3.  **Activate the virtual environment:**
    *   **Windows (PowerShell):**
        ```powershell
        .venv\Scripts\Activate.ps1
        ```
    *   **Windows (CMD):**
        ```cmd
        .venv\Scripts\activate.bat
        ```
    *   **macOS / Linux:**
        ```bash
        source .venv/bin/activate
        ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

---

## 🚀 Running the Application

Start the development server using:
```bash
python app.py
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔒 License

Distributed under the MIT License. See `LICENSE` for more information.
