// Serves the saved sample feeds on http://localhost:4100 for the acceptance tests.
// Any request for /pixel.png is logged to pixel-hits.log, so AT-15 can prove that an image
// tag inside a feed summary never loads in a reader's browser.
import { createServer } from "node:http";
import { readFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.FIXTURE_PORT ?? 4100);

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/pixel.png") {
    await appendFile(join(dir, "pixel-hits.log"), `${new Date().toISOString()}\n`);
  }
  const file = normalize(join(dir, path));
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    const type = file.endsWith(".xml") ? "application/xml" : file.endsWith(".png") ? "image/png" : "text/plain";
    res.writeHead(200, { "content-type": type }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Sample feeds on http://localhost:${port}`));
