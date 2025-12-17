# BTC Ticker (VS Code Extension)

Shows **Bitcoin (BTC) price in USD** in the VS Code status bar. It refreshes automatically (default: **every 60 seconds**) using the **Coinbase spot price API**.

## Usage

- After installing/running the extension, look at the **status bar** (bottom).
- Click the status bar item to refresh manually, or run the command:
  - `BTC Ticker: Refresh`

## Settings

- `btcTicker.refreshIntervalSeconds` (default: `60`, minimum: `10`)
- `btcTicker.statusBarAlignment` (`right` / `left`)
- `btcTicker.statusBarPriority` (default: `100`)
- `btcTicker.statusBarColor` (theme-aware dropdown, default: `charts.green`)

## Development

```bash
npm install
npm run compile
```

Then press **F5** in VS Code to run the Extension Development Host.


