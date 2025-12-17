import * as vscode from 'vscode';
import * as https from 'https';

type CoinbaseSpotResponse = {
  data?: {
    amount?: string;
    base?: string;
    currency?: string;
  };
};

function httpsGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'vscode-btc-ticker',
          Accept: 'application/json'
        }
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        res.setEncoding('utf8');
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw) as T);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function fetchBtcUsdPrice(): Promise<number> {
  const url = 'https://api.coinbase.com/v2/prices/spot?currency=USD';
  const json = await httpsGetJson<CoinbaseSpotResponse>(url);
  const amount = json.data?.amount;
  if (!amount) throw new Error('Unexpected Coinbase response');
  const value = Number(amount);
  if (!Number.isFinite(value)) throw new Error('Invalid price');
  return value;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('btcTicker');
  const refreshIntervalSeconds = cfg.get<number>('refreshIntervalSeconds', 60);
  const statusBarAlignment = cfg.get<'left' | 'right'>('statusBarAlignment', 'right');
  const statusBarPriority = cfg.get<number>('statusBarPriority', 100);
  const statusBarColor = cfg.get<string>('statusBarColor', 'charts.green');
  return { refreshIntervalSeconds, statusBarAlignment, statusBarPriority, statusBarColor };
}

export function activate(context: vscode.ExtensionContext) {
  const refreshCommand = vscode.commands.registerCommand('btcTicker.refresh', async () => {
    await refreshOnce();
  });
  context.subscriptions.push(refreshCommand);

  const { statusBarAlignment, statusBarPriority, statusBarColor } = getConfig();
  const alignment =
    statusBarAlignment === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

  const item = vscode.window.createStatusBarItem(alignment, statusBarPriority);
  item.command = 'btcTicker.refresh';
  // Theme-aware color (user-configurable) so it stays readable across light/dark themes.
  item.color = new vscode.ThemeColor(statusBarColor);
  item.text = 'BTC: …';
  item.tooltip = 'BTC Ticker (click to refresh)';
  item.show();
  context.subscriptions.push(item);

  let inFlight: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;

  async function refreshOnce() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        item.text = 'BTC: …';
        const price = await fetchBtcUsdPrice();
        item.text = `BTC ${formatUsd(price)}`;
        item.tooltip = `Coinbase spot price (USD)\nUpdated: ${new Date().toLocaleString()}\nClick to refresh`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        item.text = 'BTC: --';
        item.tooltip = `BTC Ticker error: ${msg}\nClick to retry`;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  function startTimer() {
    const { refreshIntervalSeconds: secs } = getConfig();
    const ms = Math.max(10, secs) * 1000;
    if (timer) clearInterval(timer);
    timer = setInterval(() => void refreshOnce(), ms);
  }

  startTimer();
  void refreshOnce();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('btcTicker')) return;
      // Apply color changes immediately. Alignment/priority require recreating the item,
      // but we keep those as "startup" settings for now.
      const { statusBarColor: newColor } = getConfig();
      item.color = new vscode.ThemeColor(newColor);
      startTimer();
      void refreshOnce();
    })
  );

  context.subscriptions.push({
    dispose() {
      if (timer) clearInterval(timer);
    }
  });
}

export function deactivate() {
  // no-op (resources are disposed via subscriptions)
}


