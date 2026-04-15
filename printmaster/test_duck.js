const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('who won t20 world cup 2024')}`;
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(res => res.text())
  .then(html => {
    // DuckDuckGo Lite snippets are inside <a class="result__snippet ...">
    const snippetMatch = html.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/i);
    if (snippetMatch) {
      console.log("Found Snippet:", snippetMatch[1].replace(/<[^>]+>/g, '').trim());
    } else {
      console.log("No snippet found.");
    }
  });
