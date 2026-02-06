import express, { Request, Response } from "express";
import Database from "better-sqlite3";
import { join, resolve } from "path";
import chokidar from "chokidar";

const PORT = 3333;
const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const BEADS_DIR = join(PROJECT_ROOT, ".beads");
const DB_PATH = join(BEADS_DIR, "beads.db");

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: number;
  issue_type: string;
  assignee: string | null;
  description: string;
  design: string;
  acceptance_criteria: string;
  notes: string;
  close_reason: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: string[];
  parent_id: string | null;
  children: string[];
}

function queryIssues(): Issue[] {
  const db = new Database(DB_PATH);
  db.pragma("query_only = ON");
  try {
    const rows = db
      .prepare(
        `SELECT i.id, i.title, i.status, i.priority, i.issue_type, i.assignee,
              i.description, i.design, i.acceptance_criteria, i.notes,
              i.close_reason, i.created_at, i.updated_at, i.closed_at
       FROM issues i
       WHERE i.status <> 'tombstone' AND i.deleted_at IS NULL
       ORDER BY i.priority ASC, i.updated_at DESC`
      )
      .all() as Issue[];

    // Fetch labels for all issues
    const labelRows = db
      .prepare(`SELECT issue_id, label FROM labels`)
      .all() as { issue_id: string; label: string }[];
    const labelMap = new Map<string, string[]>();
    for (const row of labelRows) {
      if (!labelMap.has(row.issue_id)) labelMap.set(row.issue_id, []);
      labelMap.get(row.issue_id)!.push(row.label);
    }

    // Fetch parent-child dependencies
    const depRows = db
      .prepare(
        `SELECT issue_id, depends_on_id FROM dependencies WHERE type = 'parent-child'`
      )
      .all() as { issue_id: string; depends_on_id: string }[];

    // parent_id: issue_id is the parent, depends_on_id is the child
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();
    for (const dep of depRows) {
      childToParent.set(dep.depends_on_id, dep.issue_id);
      if (!parentToChildren.has(dep.issue_id))
        parentToChildren.set(dep.issue_id, []);
      parentToChildren.get(dep.issue_id)!.push(dep.depends_on_id);
    }

    for (const row of rows) {
      row.labels = labelMap.get(row.id) || [];
      row.parent_id = childToParent.get(row.id) || null;
      row.children = parentToChildren.get(row.id) || [];
    }

    return rows;
  } finally {
    db.close();
  }
}

// SSE clients
const clients = new Set<Response>();

function broadcast() {
  const issues = queryIssues();
  const data = JSON.stringify(issues);
  for (const client of clients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Debounced broadcast
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedBroadcast() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(broadcast, 100);
}

// Watch the entire .beads directory for DB changes (WAL, SHM, main db)
const watcher = chokidar.watch(BEADS_DIR, {
  persistent: true,
  ignoreInitial: true,
  ignored: /(daemon\.log|daemon\.lock|daemon\.pid|bd\.sock)/,
});
watcher.on("change", debouncedBroadcast);
watcher.on("add", debouncedBroadcast);

// Express app
const app = express();
app.use(express.static(join(import.meta.dirname, "public")));

app.get("/api/issues", (_req: Request, res: Response) => {
  res.json(queryIssues());
});

app.get("/api/events", (_req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state immediately
  const issues = queryIssues();
  res.write(`data: ${JSON.stringify(issues)}\n\n`);

  clients.add(res);
  _req.on("close", () => clients.delete(res));
});

app.listen(PORT, () => {
  console.log(`Beads Kanban Board: http://localhost:${PORT}`);
  console.log(`Reading from: ${DB_PATH}`);
});
