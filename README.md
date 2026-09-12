# UK Inflation Tool

Web and iPhone apps for exploring UK CPI, CPIH and RPI weights, price changes, contribution estimates, and ONS intensity classifications.

Live entry point:

```text
inflation.html
```

The app source lives in `web/`:

- `web/index.html` - local development page
- `web/app.js` - calculations, filtering, sorting, copy/paste, and UI logic
- `web/styles.css` - visual styling
- `web/data/inflation.json` - exported CPI/CPIH/RPI data used by the app
- `web/data/inflation-data.js` - JavaScript fallback copy of the same data
- `mobile/` - Expo iPhone app and its bundled fallback data
- `scripts/data/ons-intensity-source/` - versioned ONS import- and energy-intensity source workbooks

To refresh data locally after updating `Weights And Prices.xlsx`, run:

```text
Update Inflation Data.bat
```

The batch file commits and pushes the regenerated web and mobile data files.
