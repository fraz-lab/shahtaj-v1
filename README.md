# Shahtaj Order Booker

Custom **Odoo 18** application for field sales and order booking. Distributors manage zones, routes, shops, and order bookers; field staff run visits with GPS check-in, task generation, and sales targets.

## Overview

| Item | Value |
|------|-------|
| **Display name** | Shahtaj Order Booker |
| **Technical module name** | `shahtaj_order_booker` |
| **Odoo version** | 19.0 |
| **Python version** | 3.10 or 3.11 (recommended; Odoo 18 also supports 3.12) |
| **License** | LGPL-3 |

### Features

- **Zones & routes** — Organize shops into geographic zones and sales routes
- **Order bookers** — Dedicated user role for field staff with distributor management
- **Weekly schedules** — Assign order bookers to routes by day
- **Visits & tasks** — Plan and track shop visits; generate tasks from schedules
- **GPS check-in** — Record visit location at check-in
- **Targets** — Set and monitor visit/sales targets
- **Sales integration** — Extends `sale`, `contacts`, `mail`, and `account`

### Repository layout

This repository contains the **custom addon only**. [Odoo Community](https://github.com/odoo/odoo) must be cloned separately into an `odoo/` folder at the project root (see setup below).

```
.
├── README.md
├── odoo.conf              # Local config (create yourself; not committed)
├── odoo/                  # Odoo 18 source (clone separately)
└── odoo_addons/
    └── shahtaj_order_booker/   # This module
```

---

## Prerequisites

Install these on your machine before starting:

| Requirement | Notes |
|-------------|-------|
| **Git** | To clone this repo and Odoo |
| **Python 3.10 or 3.11** | Match your OS; verify with `python --version` |
| **PostgreSQL 14+** | Database server (15 or 16 also work) |
| **pip** | Usually included with Python |

### Optional but helpful

- **virtualenv** — Isolated Python environment (recommended)
- **build tools** — On Linux you may need `libpq-dev`, `python3-dev`, and similar packages to build `psycopg2`

---

## Local setup

### 1. Clone this repository

```bash
git clone <repository-url> order-bookerv1
cd order-bookerv1
```

### 2. Clone Odoo 18

Odoo core is not bundled in this repo. Clone the official `18.0` branch into `./odoo`:

```bash
git clone https://github.com/odoo/odoo.git --branch 18.0 --depth 1 odoo
```

### 3. Create a Python virtual environment

**Linux / macOS:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (PowerShell):**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 4. Install Python dependencies

Dependencies come from Odoo’s own requirements file:

```bash
pip install --upgrade pip
pip install -r odoo/requirements.txt
```

### 5. Set up PostgreSQL

Create a database user and an empty database. Example using `psql` as the `postgres` superuser:

```sql
CREATE USER odoo WITH PASSWORD 'odoo' CREATEDB;
CREATE DATABASE shahtaj_dev OWNER odoo;
```

Adjust username, password, and database name to match your `odoo.conf` (next step).

**Windows:** Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/) and use pgAdmin or `psql` to run the commands above.

### 6. Create `odoo.conf`

Create a file named `odoo.conf` in the project root. This file is local-only and should not be committed (it may contain secrets).

```ini
[options]
admin_passwd = change_me_master_password
db_host = localhost
db_port = 5432
db_user = odoo
db_password = odoo
addons_path = odoo/addons,odoo_addons
```

| Option | Description |
|--------|-------------|
| `admin_passwd` | Master password for database management (create/restore/drop) |
| `db_*` | PostgreSQL connection settings |
| `addons_path` | Standard Odoo addons plus this project’s custom addons |

### 7. Start Odoo and install the module

From the project root, with the virtual environment activated:

```bash
python odoo/odoo-bin -c odoo.conf -d shahtaj_dev -i shahtaj_order_booker
```

| Flag | Meaning |
|------|---------|
| `-c odoo.conf` | Use your config file |
| `-d shahtaj_dev` | Database name (created on first run if it does not exist) |
| `-i shahtaj_order_booker` | Install this module on first startup |

Open a browser at **http://localhost:8069**, complete the database setup wizard if prompted, then log in.

### 8. Run Odoo after the first install

For day-to-day development, omit `-i` so the module is not reinstalled every time:

```bash
python odoo/odoo-bin -c odoo.conf -d shahtaj_dev
```

Useful development flags:

```bash
# Auto-reload Python code on change
python odoo/odoo-bin -c odoo.conf -d shahtaj_dev --dev=reload

# Upgrade module after code changes
python odoo/odoo-bin -c odoo.conf -d shahtaj_dev -u shahtaj_order_booker
```

---

## Using the application

1. Log in as an administrator.
2. Open the **Shahtaj** app from the main menu (or install **Shahtaj Order Booker** from Apps if needed).
3. Typical setup order:
   - Create **Zones**
   - Create **Routes** and assign shops
   - Create **Order Bookers** (distributor workflow)
   - Configure **Weekly Schedules**
   - Generate **Visit tasks** and record **Visits** with GPS check-in

### User roles

| Group | Purpose |
|-------|---------|
| **Shahtaj / Distributor** | Full setup: zones, routes, schedules, order bookers |
| **Shahtaj / Order Booker** | Field user: visits, check-ins, orders |

Assign groups under **Settings → Users & Companies → Users**.

---

## Module dependencies

The following standard Odoo modules are required and are installed automatically:

- `base`
- `contacts`
- `sale`
- `mail`
- `account`

---

## Troubleshooting

### `Module not found: shahtaj_order_booker`

- Confirm `addons_path` in `odoo.conf` includes `odoo_addons`
- Run Odoo from the **project root** so relative paths resolve correctly

### Database connection errors

- Ensure PostgreSQL is running
- Verify `db_user`, `db_password`, `db_host`, and `db_port` in `odoo.conf`
- Ensure the PostgreSQL user has `CREATEDB` if Odoo should create the database

### `psycopg2` install fails

- **Linux:** `sudo apt install libpq-dev python3-dev` (Debian/Ubuntu) then retry `pip install`
- **Windows:** Use a recent pip; it usually installs a prebuilt wheel

### Port 8069 already in use

- Stop the other Odoo instance, or add `http_port = 8070` (or another free port) to `odoo.conf`

### Python version mismatch

- Odoo 18 expects Python 3.10–3.12. Recreate `.venv` with a supported version:

  ```bash
  python3.11 -m venv .venv
  ```

### Upgrading the module

After pulling code changes on an existing database:

```bash
python odoo/odoo-bin -c odoo.conf -d your_database -u shahtaj_order_booker
```

### `bad marshal data` when loading the module

Stale Python cache from an older install can cause this. Clear cache and retry:

```powershell
Get-ChildItem -Path "odoo_addons\shahtaj_order_booker" -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
python odoo/odoo-bin -c odoo.conf -d your_database -u shahtaj_order_booker
```

### PostgreSQL collation error on Windows

If you see `collations with different collate and ctype values are not supported`, recreate the database with matching locale settings (both `C`):

```sql
DROP DATABASE IF EXISTS shahtaj_dev;
CREATE DATABASE shahtaj_dev WITH OWNER = odoo ENCODING = 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C' TEMPLATE = template0;
```

---

## Development notes

- Custom code lives under `odoo_addons/shahtaj_order_booker/`
- After changing Python or XML files, upgrade the module: `-u shahtaj_order_booker`
- Database migrations are in `odoo_addons/shahtaj_order_booker/migrations/`

---

## Links

- [Odoo 18 documentation](https://www.odoo.com/documentation/18.0/)
- [Odoo Community source (18.0)](https://github.com/odoo/odoo/tree/18.0)
