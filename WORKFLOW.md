# UK Inflation Tool Workflow

This project powers the static UK inflation tool at:

https://chitroda.com/inflation.html

The live site is served from GitHub Pages via the `main` branch of:

https://github.com/ronak86/uk-inflation-tool

## Important Files

- `inflation.html`  
  The public entry point for GitHub Pages.

- `web/index.html`  
  The local development entry point.

- `web/app.js`  
  Most of the app logic: table rendering, filters, sorting, chart context menu, contribution calculations, sector handling, tabs, and copy behaviour.

- `web/styles.css`  
  Visual styling for the app.

- `web/data/inflation.json` and `web/data/inflation-data.js`  
  Generated data used by the browser app.

- `Weights And Prices.xlsx`  
  The source workbook now tracked in Git. It contains CPI, CPIH, RPI, headline overall series, and definitions used to build the generated data.

- `scripts/update_workbook_from_ons.py`  
  Downloads the latest ONS detailed reference tables and updates `Weights And Prices.xlsx`.

- `scripts/export_inflation_data.py`  
  Converts `Weights And Prices.xlsx` into the generated web and mobile data files, attaching the ONS intensity classifications.

- `scripts/data/ons-intensity-source/`
  Auditable ONS source workbooks for CPI/CPIH import intensity and CPI energy intensity. CPIH energy classifications are derived from corresponding CPI COICOP classes; OOH and Council Tax remain unclassified. RPI has no intensity classification.

- `automation/inflation-release-dates.txt`
  The single list of ONS release dates used by the Pi trigger, GitHub backup and reminder.

- `automation/raspberry-pi/`
  The Pi trigger script, systemd service/timer and setup notes.

- `.github/workflows/update-inflation-data.yml`  
  The GitHub Actions update worker and delayed cloud backup.

- `.github/workflows/inflation-release-reminder.yml`  
  Sends a notification at 21:00 London time the night before each scheduled release.

- `scripts/send_notification_email.py`  
  Sends notification emails from GitHub Actions using SMTP credentials stored as GitHub Secrets.

## What Happens on GitHub

The Raspberry Pi normally dispatches the GitHub workflow named `Update inflation data` at 07:05 London time. GitHub remains the worker: the Pi does not download or process the workbook itself.

Release dates are listed once in `automation/inflation-release-dates.txt`:

- 22 July 2026
- 19 August 2026
- 16 September 2026
- 21 October 2026
- 18 November 2026
- 16 December 2026
- 20 January 2027
- 17 February 2027

On each dispatched run GitHub will:

1. Check that the current London date is one of the expected release dates.
2. Skip the run if the expected month is already live.
3. Download the latest ONS detailed reference tables workbook.
4. If ONS is late, retry every two minutes for up to 30 minutes.
5. Update `Weights And Prices.xlsx` only after all required ONS tables contain the expected month.
6. Rebuild `web/data/inflation.json` and `web/data/inflation-data.js`.
7. Rebuild `mobile/assets/data/inflation.json`.
8. Validate the mobile calculation engine.
9. Commit the changed workbook and generated data files.
10. Push the commit to `main`.
11. GitHub Pages updates the live website automatically.
12. A notification email is sent when the update finishes successfully or fails.

GitHub also checks every day at 08:30 UTC as a later backup. Non-release dates and already-completed releases are no-ops. The PC does not need to be switched on.

## Notifications

The repo has two email notification points:

1. The night before each release at 21:00 London time, GitHub sends a reminder that the app is due to update the next morning.
2. After the scheduled update completes, GitHub sends either a success email or a failure email.

The emails require these GitHub repository secrets:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `NOTIFY_EMAIL_FROM`
- `NOTIFY_EMAIL_TO`

For Gmail, use an app password rather than your normal Google password.

## Manual GitHub Run

To run the cloud update manually:

1. Open the GitHub repo.
2. Go to `Actions`.
3. Select `Update inflation data`.
4. Click `Run workflow`.

This is useful if ONS publishes late or if a release needs to be rerun.

## What Happens Locally

The local folder is still useful for development and manual updates.

- Double-click `Start Inflation App.bat` to serve the site locally.
- Double-click `Update Workbook From ONS.bat` to update `Weights And Prices.xlsx` from ONS on this PC.
- Double-click `Update Inflation Data.bat` to rebuild the web data, commit it, and push it.
- Double-click `Schedule Inflation Updates.bat` only if you want to recreate the old Windows Task Scheduler jobs.

The Windows scheduled tasks remain disabled. The Raspberry Pi is the precise scheduler and GitHub Actions is the update worker and backup.

## Local Clutter

These are deliberately ignored locally:

- `raw_ons/`
- `logs/`
- `tmp/`
- `outputs/`
- old workbook backups
- downloaded PDFs or macro workbooks
- local scratch workbook copies

They are not needed for the live website.
