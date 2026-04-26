# UK Inflation Tool

Static web app for exploring UK CPI and CPIH weights, price changes, and contribution estimates.

Live entry point:

```text
inflation.html
```

The app source lives in `web/`:

- `web/index.html` - local development page
- `web/app.js` - calculations, filtering, sorting, copy/paste, and UI logic
- `web/styles.css` - visual styling
- `web/data/cpih.json` - exported CPI/CPIH data used by the app
- `web/data/cpih-data.js` - JavaScript fallback copy of the same data

To refresh data locally after updating `Weights And Prices.xlsx`, run:

```text
Update CPIH Data.bat
```

Then commit and push the regenerated files in `web/data/`.
