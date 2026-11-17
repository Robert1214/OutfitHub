/**
 * 开发期测试数据工具（只操作 demo 账号，绝不碰真实用户数据）。
 *
 * 用法：
 *   node scripts/dev-fixtures.mjs seed             用 demo 账号造 3 件单品 + 1 套搭配
 *   node scripts/dev-fixtures.mjs clean            只清 demo 账号的单品/搭配/标签 + COS
 *   node scripts/dev-fixtures.mjs status           查看各账号数据量
 *
 * 依赖：本地 dev server 已在 http://localhost:3000 运行。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import COS from "cos-nodejs-sdk-v5";

const BASE = "http://localhost:3000";
/** 测试专用账号：demo@outfitexpert.demo / Demo123456 */
const DEMO_EMAIL = "demo@outfitexpert.demo";
const DEMO_PASSWORD = "Demo123456";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const TMP_DIR = path.join(ROOT, ".local");
const COOKIE_FILE = path.join(TMP_DIR, "dev-fixtures-cookies.txt");

const SAMPLES = [
  {
    file: "memory-bank/assets/product-samples/s04-navy-shirt.jpg",
    name: "深蓝衬衫",
    category: "TOP",
    tags: ["通勤"],
  },
  {
    file: "memory-bank/assets/product-samples/s02-draped-trousers.jpg",
    name: "米色阔腿裤",
    category: "BOTTOM",
    tags: ["通勤"],
  },
  {
    file: "memory-bank/assets/product-samples/s05-ivory-adidas-jacket.jpg",
    name: "米白外套",
    category: "TOP",
    tags: ["休闲"],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv() {
  const env = fs.readFileSync(ENV_FILE, "utf8");
  return (key) => (env.match(new RegExp(`${key}="([^"]*)"`)) || [])[1];
}

function curl(args) {
  return execFileSync("curl", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

/** 用 demo 账号登录，写 cookie 文件并返回 cookie 字符串 */
async function login() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const csrf = JSON.parse(curl(["-s", "-c", COOKIE_FILE, `${BASE}/api/auth/csrf`])).csrfToken;

  curl([
    "-s", "-b", COOKIE_FILE, "-c", COOKIE_FILE,
    "-X", "POST", `${BASE}/api/auth/callback/credentials`,
    "-H", "Content-Type: application/x-www-form-urlencoded",
    "-d",
    `csrfToken=${csrf}&email=${encodeURIComponent(DEMO_EMAIL)}&password=${encodeURIComponent(DEMO_PASSWORD)}&callbackUrl=/&json=true`,
    "-o", "NUL",
  ]);

  // 从 cookie jar 抽出 session-token（jar 行可能以 #HttpOnly_ 开头，不能按 # 过滤）
  const jar = fs.readFileSync(COOKIE_FILE, "utf8");
  const line = jar
    .split("\n")
    .find((l) => l.includes("authjs.session-token"));
  if (!line) throw new Error("登录失败：未拿到 session token");
  const parts = line.trim().split("\t");
  const cookie = `authjs.session-token=${parts[parts.length - 1].trim()}`;

  const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie } }).then((r) => r.json());
  if (!session?.user?.id) throw new Error("登录失败：会话无效");
  if (session.user.email !== DEMO_EMAIL) {
    throw new Error(`登录账号不对：${session.user.email}，应为 ${DEMO_EMAIL}`);
  }
  console.log(`已登录测试账号 ${DEMO_EMAIL}（${session.user.id}）`);
  return { cookie, userId: session.user.id };
}

const api = (cookie, pathname, init = {}) =>
  fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { cookie, "Content-Type": "application/json", ...(init.headers ?? {}) },
  }).then((r) => r.json());

async function uploadFile(cookie, file, purpose) {
  const args = [
    "-s", "-b", COOKIE_FILE, "-X", "POST", `${BASE}/api/wardrobe/upload`,
    "-F", `files=@${file}`,
  ];
  if (purpose) args.push("-F", `purpose=${purpose}`);
  const res = JSON.parse(curl(args));
  const key = res.images?.[0]?.key;
  if (!key) throw new Error(`上传失败：${JSON.stringify(res).slice(0, 200)}`);
  return key;
}

async function cutout(cookie, originalKey) {
  const start = await api(cookie, "/api/wardrobe/cutout", {
    method: "POST",
    body: JSON.stringify({ originalKey }),
  });
  if (!start.taskId) throw new Error(`去背景发起失败：${JSON.stringify(start)}`);

  for (let i = 0; i < 40; i += 1) {
    await sleep(1500);
    const query = new URLSearchParams({ taskId: start.taskId, originalKey });
    const res = await api(cookie, `/api/wardrobe/cutout?${query}`);
    if (res.status === "SUCCEEDED") return res;
    if (res.status === "FAILED") throw new Error(`去背景失败：${res.error}`);
  }
  throw new Error("去背景超时");
}

async function seed() {
  const { cookie } = await login();
  const itemIds = [];

  for (const sample of SAMPLES) {
    const originalKey = await uploadFile(cookie, path.join(ROOT, sample.file));
    const cut = await cutout(cookie, originalKey);
    const created = await api(cookie, "/api/items", {
      method: "POST",
      body: JSON.stringify({
        name: sample.name,
        category: sample.category,
        tags: sample.tags,
        images: [
          {
            whiteKey: cut.whiteKey,
            flatKey: cut.flatKey,
            originalKey,
            sortOrder: 0,
          },
        ],
      }),
    });
    if (!created.id) throw new Error(`创建单品失败：${JSON.stringify(created)}`);
    itemIds.push(created.id);
    console.log(`  + ${sample.name}`);
  }

  const look = await api(cookie, "/api/looks", {
    method: "POST",
    body: JSON.stringify({
      name: "测试搭配",
      occasion: "上班",
      tags: ["通勤"],
      wornAt: new Date().toISOString(),
      itemIds: itemIds.slice(0, 2),
    }),
  });
  if (!look.id) throw new Error(`创建搭配失败：${JSON.stringify(look)}`);
  console.log(`  + 搭配「测试搭配」(${look.id})`);
  console.log("完成。");
}

async function clean() {
  const { cookie, userId } = await login();

  const looks = await api(cookie, "/api/looks?page=1");
  for (const look of looks.looks ?? []) {
    await fetch(`${BASE}/api/looks/${look.id}`, { method: "DELETE", headers: { cookie } });
  }
  const items = await api(cookie, "/api/items?page=1");
  for (const item of items.items ?? []) {
    await fetch(`${BASE}/api/items/${item.id}`, { method: "DELETE", headers: { cookie } });
  }

  // 兜底：清 demo 账号在 COS 下的残留对象
  const get = readEnv();
  const cos = new COS({ SecretId: get("TENCENT_SECRET_ID"), SecretKey: get("TENCENT_SECRET_KEY") });
  const bucket = { Bucket: get("TENCENT_COS_BUCKET"), Region: get("TENCENT_COS_REGION") };
  for (const prefix of [`wardrobe/${userId}/`, `outfits/${userId}/`]) {
    await new Promise((resolve) => {
      cos.getBucket({ ...bucket, Prefix: prefix }, (e, d) => {
        const keys = (d?.Contents ?? []).map((c) => c.Key);
        if (!keys.length) return resolve();
        cos.deleteMultipleObject(
          { ...bucket, Objects: keys.map((Key) => ({ Key })) },
          () => resolve(),
        );
      });
    });
  }
  console.log(`已清理测试账号数据（${(looks.looks ?? []).length} 套搭配、${(items.items ?? []).length} 件单品）`);
}

async function status() {
  const { cookie, userId } = await login();
  const looks = await api(cookie, "/api/looks?page=1");
  const items = await api(cookie, "/api/items?page=1");
  console.log(`测试账号 ${DEMO_EMAIL}`);
  console.log(`  单品 ${items.total ?? 0} 件：${(items.items ?? []).map((i) => i.name).join("、") || "（空）"}`);
  console.log(`  搭配 ${looks.total ?? 0} 套：${(looks.looks ?? []).map((l) => l.name).join("、") || "（空）"}`);
  console.log(`  userId: ${userId}`);
}

const command = process.argv[2] ?? "status";
const handlers = { seed, clean, status };
if (!handlers[command]) {
  console.log("用法: node scripts/dev-fixtures.mjs [seed|clean|status]");
  process.exit(1);
}
await handlers[command]().catch((error) => {
  console.error("失败：", error.message);
  process.exit(1);
});
