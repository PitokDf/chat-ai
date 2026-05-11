async function searchDDG(query) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const text = await res.text();
    const results = [];
    
    // Very basic regex to extract a tags and snippets from duckduckgo html
    const regex = /<a class="result__url" href="([^"]+)">[^<]+<\/a>.*?<a class="result__snippet[^>]+>(.*?)<\/a>/gs;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (results.length >= 5) break;
      results.push({
        url: match[1],
        snippet: match[2].replace(/<[^>]+>/g, '').trim()
      });
    }
    console.log(results);
  } catch (e) {
    console.error(e);
  }
}
searchDDG("latest AI news");
