// Import the shared grading checklist into a running loopback demo.
const issues = require("./fixtures/grading-issues.json");

async function main() {
  const port = Number(process.env.PORT || 3200);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid demo port.");
  const base = `http://127.0.0.1:${port}`;
  let session;
  async function request(route, body) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", ...(session ? { cookie: session } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`${route} returned HTTP ${response.status}`);
    if (route === "/api/login") session = response.headers.get("set-cookie")?.split(";")[0];
    return response.json();
  }
  const account = (await request("/api/me")).demo?.accounts.find(item => item.role === "admin");
  if (!account) throw new Error("Start the local demo first.");
  const { user } = await request("/api/login", account);
  if (!user.admin || !session) throw new Error("Demo admin sign-in failed.");
  const route = "/api/admin/project/issues";
  const existing = (await request(route + "?label=grading")).issues;
  const labels = new Set(existing.flatMap(issue => issue.labels));
  let created = 0;
  for (const issue of issues) {
    const key = issue.labels.find(label => label.startsWith("grade:"));
    if (!labels.has(key)) {
      await request(route, issue);
      labels.add(key);
      created++;
    }
  }
  console.log(`Grading tracker: ${created} added, ${issues.length - created} already present.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
