# Windows setup — run the whole project

## 1. Install prerequisites

- Node.js 22.12+ (Node 24 is suitable).
- Python 3.12 (the Python lock file was tested with 3.12).
- MongoDB Community Server, running locally as a Windows service, **or** a MongoDB Atlas connection string.
- Git, if you want to push to GitHub.

Check in PowerShell:

```powershell
node --version
npm --version
py -3.12 --version
git --version
```

MongoDB Compass is a GUI; installing Compass alone does not create a local database server. Follow official MongoDB installation documentation linked in REFERENCES.md. For Atlas, use your own database user, connection string and network access configuration.

## 2. Extract and install

Extract the ZIP. In PowerShell, move into the extracted `da-scheduling-assistant` folder containing the root `package.json`:

```powershell
cd "C:\Users\YOUR_NAME\Downloads\da-scheduling-assistant"
npm ci
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scheduler\requirements.txt
Copy-Item server\.env.example server\.env
Copy-Item scheduler\.env.example scheduler\.env
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` in these commands rather than changing your global execution policy. The Python commands use the executable directly; activating the virtual environment is unnecessary.

## 3. Configure the backend

Open `server/.env` in your editor. Set:

```dotenv
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/da_scheduler
CLIENT_ORIGIN=http://localhost:5173
SCHEDULER_URL=http://127.0.0.1:8000
SCHEDULER_KEY=YOUR_LONG_RANDOM_SECRET
NODE_ENV=development
SEED_EMAIL=your-email@example.com
SEED_PASSWORD=YOUR_UNIQUE_PASSWORD_OF_AT_LEAST_12_CHARACTERS
SEED_NAME=Your Name
```

Generate a random service secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy that value into `SCHEDULER_KEY` in **both** `server/.env` and `scheduler/.env`. This is a service-to-service secret, not your login password. Password length is 12–72 characters. Do not commit either `.env` file.

## 4. Create your first manager

Ensure MongoDB is running, then from the project root:

```powershell
npm run seed
```

This creates one neighborhood and manager. It does not create employees or sample shifts. Repeating it with the same email deliberately fails instead of overwriting your data. After successful creation, remove `SEED_PASSWORD` from `.env` if you no longer need it.

For a second neighborhood, set a different manager email, name/password, and add `SEED_NEIGHBORHOOD=Neighborhood 2`, then run seed again. Accounts cannot share emails across neighborhoods. Managers cannot browse other neighborhoods.

## 5. Start the Python service — terminal 1

From the project root:

```powershell
$env:SCHEDULER_KEY = (Get-Content scheduler\.env | Where-Object { $_ -match '^SCHEDULER_KEY=' } | Select-Object -First 1) -replace '^SCHEDULER_KEY=', ''
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir scheduler --host 127.0.0.1 --port 8000
```

Keep this terminal open. Python does not automatically load `.env`; the command above loads the one required variable explicitly.

## 6. Start React and Express — terminal 2

```powershell
npm run dev
```

Open **http://localhost:5173** and sign in with your seeded manager email/password. Use `localhost`, matching `CLIENT_ORIGIN`. Vite proxies `/api` to Express, so login cookies remain same-origin.

## 7. First schedule

Follow FIRST_RUN.md. Create DA accounts, have them enter availability, configure operating hours, create blocks, generate and review, then publish. No account has availability until it is entered.

## 8. Run tests

Python:

```powershell
cd scheduler
..\.venv\Scripts\python.exe -m pytest -q
cd ..
```

React interaction tests:

```powershell
npm run test:ui
```

API and time/domain tests:

```powershell
npm test
```

The default API test starts a disposable real MongoDB process and stubs the scheduling HTTP service; Python tests independently run the real solver. To run API tests against your running real scheduler:

```powershell
$env:SCHEDULER_KEY = (Get-Content scheduler\.env | Where-Object { $_ -match '^SCHEDULER_KEY=' } | Select-Object -First 1) -replace '^SCHEDULER_KEY=', ''
npm test
```

For an environment that cannot start MongoDB, `$env:IN_MEMORY_TEST='1'` activates the test-only repository double. Remove it with `Remove-Item Env:IN_MEMORY_TEST` to return to real database tests.

## Troubleshooting

| Message | Fix |
| --- | --- |
| Cannot connect to MongoDB / ECONNREFUSED 27017 | Start MongoDB service or correct Atlas URI and network access. |
| Please sign in | Log in again; sessions expire after eight hours. |
| Untrusted request origin | Use the URL matching CLIENT_ORIGIN, restart backend after edits. |
| Scheduling service rejected request | Check both service secrets match and Python is running. |
| Server error during Generate | Read backend terminal and scheduler logs; check connectivity. |
| Operating hours without coverage blocks | Add missing blocks or correct operating hours. |
| No assignments | Have DAs enter availability; check rules and coverage explanations. |
| Someone changed this neighborhood | Refresh, review latest state, then retry. |
| Port in use | Stop the other process or change port and matching proxy/origin settings. |
| Python installation fails | Use 64-bit Python 3.12 and a fresh virtual environment. |

## Optional Docker route

If Docker Desktop is available, create root `.env` from `.env.docker.example`, set the required secrets and run:

```powershell
docker compose up --build -d
# Wait until the database and app are running, then:
docker compose exec app npm run seed
```

Open http://localhost:4000. This development compose file binds only localhost; it is not an HTTPS production deployment. `docker compose down` stops services without removing database volumes. Never add `-v` unless you intend to erase the data.
