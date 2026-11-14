// Read-only, narrowly scoped to conversation IDs and questions in one local eval run.
// Does not select request headers, process_data, reasoning_content, or unrelated chats.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveRun } from "./eval-baseline-paths.mjs";

const { dir } = resolveRun(process.argv[2]);
const results = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8")).results;
const ids = [...new Set(results.map((r) => r.conversationId).filter(Boolean))];
if (!ids.length || ids.some((id) => !/^[0-9a-f-]{36}$/.test(id))) throw new Error("Invalid conversation IDs");
const sql = `SET default_transaction_read_only = on;
SELECT jsonb_build_object(
  'conversationId',m.conversation_id,'query',m.query,'workflowRunId',m.workflow_run_id,
  'workflowId',w.workflow_id,'workflowVersion',w.version,'workflowStatus',w.status,
  'workflowSeconds',w.elapsed_time,'totalTokens',w.total_tokens,'totalSteps',w.total_steps,
  'configuration',(SELECT jsonb_agg(jsonb_build_object(
    'id',g->>'id','type',g->'data'->>'type','model',g->'data'->'model',
    'memory',g->'data'->'memory','prompt_template',g->'data'->'prompt_template',
    'code',g->'data'->'code','code_language',g->'data'->'code_language',
    'variables',g->'data'->'variables','outputs',g->'data'->'outputs',
    'url',g->'data'->'url','params',g->'data'->'params','method',g->'data'->'method',
    'headerMd5',CASE WHEN g->'data'->>'headers' IS NOT NULL THEN md5(g->'data'->>'headers') END,
    'classes',g->'data'->'classes','answer',g->'data'->'answer',
    'query_variable_selector',g->'data'->'query_variable_selector'))
    FROM jsonb_array_elements(w.graph::jsonb->'nodes') g),
  'edges',w.graph::jsonb->'edges',
  'nodes',(SELECT jsonb_agg(jsonb_build_object(
    'nodeId',n.node_id,'type',n.node_type,'title',n.title,'status',n.status,
    'seconds',n.elapsed_time,
    'extractionText',CASE WHEN n.node_id='1793705786188' THEN n.outputs::jsonb->>'text' END,
    'requirementsText',CASE WHEN n.node_type='code' THEN n.outputs::jsonb->>'requirements' END,
    'httpBody',CASE WHEN n.node_type='http-request' THEN n.outputs::jsonb->>'body' END,
    'httpStatus',CASE WHEN n.node_type='http-request' THEN n.outputs::jsonb->'status_code' END,
    'usage',n.outputs::jsonb->'usage',
    'executionTotals',jsonb_build_object('total_tokens',n.execution_metadata::jsonb->'total_tokens',
      'total_price',n.execution_metadata::jsonb->'total_price','currency',n.execution_metadata::jsonb->'currency')
    ) ORDER BY n.index)
    FROM workflow_node_executions n WHERE n.workflow_run_id=w.id))
FROM messages m JOIN workflow_runs w ON w.id=m.workflow_run_id
WHERE m.conversation_id IN (${ids.map((id) => `'${id}'::uuid`).join(",")})
ORDER BY m.created_at,m.id;`;
const output = execFileSync("docker", ["exec", "-i", "docker-db_postgres-1", "psql", "-U", "postgres", "-d", "dify", "-AtX", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const rows = output.split(/\r?\n/).filter((s) => s.startsWith("{")).map((s) => JSON.parse(s));
const mapped = results.map((r) => {
  const matches = rows.filter((t) => t.conversationId === r.conversationId && t.query === r.request.query);
  return { key: r.key, matches };
});
fs.writeFileSync(path.join(dir, "workflow-traces.json"), JSON.stringify({ retrievedAt: new Date().toISOString(),
  source: "Dify local PostgreSQL read-only query", scope: "only this run conversation IDs and matching questions",
  rows: mapped }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ turns: mapped.length, uniquelyMatched: mapped.filter((r) => r.matches.length === 1).length,
  httpNodes: rows.flatMap((r) => r.nodes || []).filter((n) => n.type === "http-request").length,
  saved: path.join(dir, "workflow-traces.json") }));
