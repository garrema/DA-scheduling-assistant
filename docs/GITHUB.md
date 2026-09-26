# Push your project to GitHub

Create a new **empty** repository on GitHub, for example `da-scheduling-assistant`. Do not initialize it with a README because this folder already contains one.

In PowerShell inside the project root:

```powershell
git init
git add .
git status
git commit -m "Build DA scheduling assistant with constraint-based scheduling"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/da-scheduling-assistant.git
git push -u origin main
```

Before committing, inspect `git status`: neither `.env` file, node_modules, a virtual environment, nor any real employee data should be listed. `.env.example` files contain placeholders and should be committed. Keep `package-lock.json` and `scheduler/requirements.txt` for reproducible installs. No real credentials are included in this archive.

If Git asks for your identity:

```powershell
git config --global user.name "Your Name"
git config --global user.email "Your GitHub email"
```

A GitHub push stores source code; it does **not** deploy the app or make a server run. MongoDB, Express and Python must run somewhere for others to use it. GitHub Pages cannot host these backend services.

The included CI workflow installs dependencies, runs Python tests, runs API tests with a real disposable MongoDB process and the real solver, and builds the frontend. Review its actual result after your first push; do not claim CI passes before it has run there.

## Suggested honest project description

“Full-stack desk-assistant scheduling prototype using React, Express, MongoDB and a Python OR-Tools service. Generates manager-reviewed assignments subject to availability, hour and rest constraints.”

After actual adoption, update with measured manager count, DA count and observed time savings. Do not imply college endorsement, live integration or adoption before those exist.
