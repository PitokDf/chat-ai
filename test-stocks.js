async function testYahoo(symbol) {
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  console.log(`\n--- YAHOO: ${symbol} ---`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
      }
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body (first 200 chars): ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function testStooq(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&e=csv`;
  console.log(`\n--- STOOQ: ${symbol} ---`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body:\n${text}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function run() {
  await testYahoo('BBRI.JK');
  await testStooq('BBRI.ID');
  await testStooq('BBRI.UK');
}

run();
