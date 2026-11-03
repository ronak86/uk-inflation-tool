# UK Inflation Tool

An iPhone app for exploring UK CPI, CPIH and RPI weights, price changes, contribution estimates, and ONS intensity classifications.

The public website has been retired. GitHub Pages remains enabled solely to publish the app's live data endpoint.

Important files:

- `web/data/inflation.json` - exported CPI/CPIH/RPI data used for live app refreshes
- `web/data/inflation-data.js` - JavaScript fallback copy of the same data
- `mobile/` - Expo iPhone app and its bundled fallback data
- `scripts/data/ons-intensity-source/` - versioned ONS import- and energy-intensity source workbooks

To refresh data locally after updating `Weights And Prices.xlsx`, run:

```text
Update Inflation Data.bat
```

The batch file commits and pushes the regenerated live and bundled mobile data files.
