/**
 * 深研档案馆 dossier 自检:宿主同款 `new Function('ctx', src)(mockCtx)` 求值 main.js。
 *
 * 覆盖(SPEC「check.mjs 额外必测」逐条):
 *   ① 四级判据 30 条已知真假向量(10 真 / 10 已腐烂 / 10 编造,含 4 条必判 UNKNOWN 的陷阱)
 *   ② normalizeUrl / parseProbeJson / parseDossier ↔ serializeDossier 往返 / reconcileClaimIds /
 *      mergeSources / diffVersions / bodyDigest / 日期 / 空输入 / XSS / 数据契约往返
 *   ③ 双语(两侧键集合相等、切 en 后重渲出现英文、切语言不改档案文件字节)
 *   ④ 两个旧宿主 ctx(缺席版 / registerFileType 退让版)
 *   ⑤ disposer / 源码扫描(写死前景色、ASI 陷阱行)
 * 跑法:node check.mjs
 */
import { readFileSync } from 'node:fs'
import { strict as A } from 'node:assert'

process.env.TZ = process.env.TZ || 'Asia/Shanghai'
const src = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

// ── 极简 DOM 垫片 ────────────────────────────────────────────────────────────
function mkText(t) {
  const n = { tag: '#text', children: [], attrs: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }
  let v = String(t)
  Object.defineProperty(n, 'textContent', { get: () => v, set: (x) => { v = String(x) } })
  return n
}
function mkEl(tag) {
  const n = { tag, children: [], attrs: {}, on: {}, style: { setProperty() {} }, disabled: false, value: '', className: '' }
  n.addEventListener = (ev, fn) => { (n.on[ev] = n.on[ev] || []).push(fn) }
  let own = ''
  n.appendChild = (c) => {
    if (c && c.tag === '#frag') { for (const k of c.children) n.children.push(k) } else n.children.push(c)
    return c
  }
  n.setAttribute = (k, val) => { n.attrs[k] = val }
  n.focus = () => {}
  Object.defineProperty(n, 'textContent', {
    get: () => own + n.children.map((c) => c.textContent || '').join(' '),
    set: (x) => { n.children.length = 0; own = String(x) },
  })
  return n
}
globalThis.document = { createElement: mkEl, createTextNode: mkText, createDocumentFragment: () => mkEl('#frag'), addEventListener() {} }
const _ls = new Map()
globalThis.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
}
const findAll = (node, tag) => {
  const out = []
  const walk = (n) => { for (const c of (n.children || [])) { if (c.tag === tag) out.push(c); walk(c) } }
  walk(node)
  return out
}
const anyAttr = (node, key) => {
  let hit = false
  const walk = (n) => { if (n.attrs && key in n.attrs) hit = true; for (const c of (n.children || [])) walk(c) }
  walk(node)
  return hit
}
const textOf = (n) => String(n.textContent || '')
// 真的把监听器存下来:不然「点保存」「改文本框」这类交互路径一行都测不到(只能靠肉眼看代码)
const clickEl = (n) => { for (const f of (n.on && n.on.click) || []) f({}) }
const typeInto = (n, v) => { n.value = String(v); for (const f of (n.on && n.on.input) || []) f({}) }
const btnBy = (root, label) => findAll(root, 'button').find((b) => textOf(b) === label)
// 未捕获 rejection = 真机门禁第 10 项当场红;全程盯着
const unhandled = []
process.on('unhandledRejection', (e) => unhandled.push(e))

// ── 冻钟 ─────────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-08-15T09:03:12.000Z')
Date.now = () => NOW

// ── mock ctx(内存 vault) ────────────────────────────────────────────────────
const vault = new Map()
const writes = []
let readThrows = false
let writeThrows = false
let loc = 'zh'
const localeSubs = new Set()
const reg = { views: [], commands: [], settings: [], status: [], fileTypes: [], fileCreators: [], slash: [], series: [], events: [], acts: [], statusUpdates: [], statusDisposed: false, listSources: [] }
const notes = []
const ctxMock = {
  registerView: (v) => reg.views.push(v),
  registerCommand: (c) => reg.commands.push(c),
  registerSetting: (s) => reg.settings.push(s),
  registerStatusItem: (s) => { reg.status.push(s); return { update: (p) => { Object.assign(s, p); reg.statusUpdates.push(p) }, dispose() { reg.statusDisposed = true } } },
  registerFileType: (f) => { reg.fileTypes.push(f); return true },
  registerFileCreator: (f) => reg.fileCreators.push(f),
  registerSlashItem: (s) => reg.slash.push(s),
  registerListSource: (x) => reg.listSources.push(x), // 统一左栏数据源(宿主 2026-08-25+)
  registerEmbedRenderer: () => {},
  achievements: { registerSeries: (s) => reg.series.push(s), track: (e, n) => reg.events.push([e, n]) },
  activity: { log: (e, d) => reg.acts.push([e, d]) },
  notify: (m, o) => notes.push([m, (o && o.level) || 'info']),
  openView: () => {},
  getLocale: () => loc,
  subscribeLocale: (cb) => { localeSubs.add(cb); return () => localeSubs.delete(cb) },
  app: {
    notify: (m) => notes.push([m, 'info']),
    workFolder: () => '深研档案馆',
    readFile: async (p) => { if (readThrows) throw new Error('EIO simulated'); return vault.has(p) ? vault.get(p) : null },
    writeFile: async (p, text) => { if (writeThrows) throw new Error('EIO write simulated'); vault.set(p, text); writes.push(p) },
    openFile: () => {},
    getActivePage: () => 'Notes/研究.md',
    getActivePageText: () => '见 https://arxiv.org/abs/2604.03173 与 https://example.org/dead?utm_source=x',
    prompt: async () => promptReply,
  },
}
let promptReply = null
const setLocale = (l) => { loc = l; localeSubs.forEach((cb) => { try { cb(l) } catch { /* ignore */ } }) }
const rerenderAllViaLocale = (l) => setLocale(l)
const tick = () => new Promise((r) => setTimeout(r, 5))

globalThis.__DOSSIER_TEST__ = {}
const dispose = new Function('ctx', src)(ctxMock)
const T = globalThis.__DOSSIER_TEST__
await tick()

// ══ ① 贡献点齐全 ════════════════════════════════════════════════════════════
A.equal(typeof dispose, 'function', 'setup 应返回 disposer')
A.equal(reg.views[0].id, 'desk', 'desk 必须是第一个 registerView(真机台架默认开首个视图)')
A.ok(reg.views.find((v) => v.id === 'run' && typeof v.mount === 'function'), '应注册 run 视图')
A.equal(reg.views.length, 2, '恰好两个视图')
for (const id of ['dossier-open', 'dossier-new', 'dossier-continue', 'dossier-check-note']) {
  A.ok(reg.commands.find((c) => c.id === id), `应注册命令 ${id}`)
}
A.deepEqual(reg.settings.map((s) => s.key).sort(), ['autoCheck', 'maxSources', 'rounds'], '三条设置')
A.ok(reg.fileTypes.find((f) => f.id === 'dossier' && f.extensions[0] === '.dossier.md'), '应注册 .dossier.md 文件类型')
A.equal(reg.fileCreators.length, 1, '应注册右键新建入口')
A.equal(reg.slash.length, 1, '应注册斜杠项')
A.equal(reg.slash[0].id, 'dossier-file', '斜杠项 id 按 SPEC 钉死')
A.equal(reg.status.length, 1, '应注册状态栏项')
A.equal(reg.series.length, 1, '应注册成就系列')
A.deepEqual(reg.series[0].achievements.map((a) => a.id).sort(), ['clean', 'deep', 'first', 'ten'], '四条成就')
A.deepEqual(reg.series[0].achievements.map((a) => a.event), ['dossier_done', 'dossier_done', 'dossier_round', 'clean_cites'], '成就事件按 SPEC')

for (const k of ['verdictOf', 'normalizeUrl', 'parseProbeJson', 'parseDossier', 'serializeDossier', 'sectionKeyOf',
  'reconcileClaimIds', 'mergeSources', 'diffVersions', 'bodyDigest', 'healthSummary', 'slugifyTopic', 'uniqueSlug',
  'parseAgentOutput', 'extractUrls', 'renderMarkdown', 'inline', 'safeHref', 'fmtDate', 'stageOf', 't']) {
  A.equal(typeof T[k], 'function', `钩子应暴露 ${k}`)
}
A.ok(Array.isArray(T.STEPS) && T.STEPS.length === 5, 'STEPS 五段')
A.ok(T.MSG && T.MSG.zh && T.MSG.en, 'MSG 应暴露')

// ══ ② 四级判据 30 条已知真假向量 ════════════════════════════════════════════
const VECTORS = [
  [1, '真', { url: 'https://a.test/1', http: 200, exit: 0, wayback: 'found' }, 'LIVE'],
  [2, '真', { url: 'https://a.test/2', http: 204, exit: 0, wayback: 'found' }, 'LIVE'],
  [3, '真', { url: 'https://a.test/3', http: 206, exit: 0, wayback: 'found' }, 'LIVE'],
  [4, '真', { url: 'https://a.test/4', http: 200, final: 'https://a.test/4-moved', exit: 0, wayback: 'found' }, 'LIVE'],
  [5, '真', { url: 'https://a.test/5', http: 200, final: 'https://b.test/5', exit: 0, wayback: 'found' }, 'LIVE'],
  [6, '真', { url: 'https://a.test/6', http: 200, final: 'https://a.test/6', exit: 0, wayback: 'found' }, 'LIVE'],
  [7, '真', { url: 'https://a.test/7', http: '200', exit: '0', wayback: 'found' }, 'LIVE'],
  [8, '真', { url: 'https://a.test/8', http: 200, final: 'https://a.test/8/', exit: 0, wayback: 'found' }, 'LIVE'],
  [9, '真', { url: 'https://a.test/9', http: 200, exit: 0, wayback: 'none' }, 'LIVE'],
  [10, '真', { url: 'https://a.test/10', http: 200, exit: 0, wayback: 'error' }, 'LIVE'],
  [11, '已腐烂', { url: 'https://a.test/11', http: 404, exit: 0, wayback: 'found', waybackTs: '20180101000000' }, 'DEAD'],
  [12, '已腐烂', { url: 'https://a.test/12', http: 410, exit: 0, wayback: 'found', waybackTs: '20200101000000' }, 'DEAD'],
  [13, '已腐烂', { url: 'https://gone.test/13', http: 0, exit: 6, wayback: 'found', waybackTs: '20190101000000' }, 'DEAD'],
  [14, '已腐烂', { url: 'https://a.test/14', http: 404, exit: 0, wayback: 'found', waybackTs: '99999999999999' }, 'DEAD'],
  [15, '已腐烂', { url: 'https://a.test/15', http: 403, exit: 0, wayback: 'none' }, 'UNKNOWN'],
  [16, '已腐烂', { url: 'https://a.test/16', http: 401, exit: 0, wayback: 'none' }, 'UNKNOWN'],
  [17, '已腐烂', { url: 'https://a.test/17', http: 405, exit: 0, wayback: 'found' }, 'UNKNOWN'],
  [18, '已腐烂', { url: 'https://a.test/18', http: 429, exit: 0, wayback: 'found' }, 'UNKNOWN'],
  [19, '已腐烂', { url: 'https://a.test/19', http: 500, exit: 0, wayback: 'found' }, 'UNKNOWN'],
  [20, '已腐烂', { url: 'https://a.test/20', http: 503, exit: 0, wayback: 'none' }, 'UNKNOWN'],
  [21, '编造', { url: 'https://a.test/21', http: 404, exit: 0, wayback: 'none' }, 'LIKELY_HALLUCINATED'],
  [22, '编造', { url: 'https://a.test/22', http: 410, exit: 0, wayback: 'none' }, 'LIKELY_HALLUCINATED'],
  [23, '编造', { url: 'https://nx.test/23', http: 0, exit: 6, wayback: 'none' }, 'LIKELY_HALLUCINATED'],
  [24, '编造', { url: 'https://a.test/24?utm_source=x&fbclid=y', http: 404, exit: 0, wayback: 'none' }, 'LIKELY_HALLUCINATED'],
  [25, '编造·陷阱', { url: 'https://a.test/25', http: 404, exit: 0, wayback: 'error' }, 'UNKNOWN'],
  [26, '编造·陷阱', { url: 'https://a.test/26', http: 404, exit: 0 }, 'UNKNOWN'],
  [27, '编造·陷阱', { url: 'https://a.test/27', http: 0, exit: 28, wayback: 'none' }, 'UNKNOWN'],
  [28, '编造·陷阱', { url: 'https://a.test/28', http: 0, exit: 60, wayback: 'none' }, 'UNKNOWN'],
]
A.equal(VECTORS.length, 28, '表内 28 条 + 探针缺席 / 探针多余 两条 = 30')
for (const row of VECTORS) {
  const got = T.verdictOf(row[2])
  A.equal(got.level, row[3], `向量 ${row[0]}(${row[1]})期望 ${row[3]},实得 ${got.level}(${got.reason})`)
  A.ok(got.reason && typeof got.reason === 'string', `向量 ${row[0]} 应给出判据理由`)
}
// 向量 29:探针整体缺该 URL → UNKNOWN + 标「未体检」
A.deepEqual(T.verdictOf(undefined), { level: 'UNKNOWN', reason: 'not_probed' }, '向量 29:缺探针 → UNKNOWN/not_probed')
A.deepEqual(T.verdictOf({ http: 200 }), { level: 'UNKNOWN', reason: 'not_probed' }, '向量 29b:没有 url 的探针不算数据')
// 向量 30:探针含未请求的 URL → 丢弃,不进档案
// ⚠️ 这里必须走**插件真正在跑的那条路径**(probeUrls 里的 applyProbes),
//    别对测试自己写的字面量求值 —— 那种断言恒真,插件一行没被执行。
{
  const requested = ['https://a.test/keep', 'https://a.test/silent']
  const parsed = T.parseProbeJson('```json\n{"probes":[{"url":"https://a.test/keep","http":200,"exit":0,"wayback":"found"},{"url":"https://evil.test/extra","http":200,"exit":0,"wayback":"found"}]}\n```')
  A.equal(parsed.ok, true)
  const rows = T.applyProbes(requested, parsed, '2026-08-15T09:03:12.000Z')
  A.equal(rows.length, 2, '向量 30:结果行数 = 请求过的 URL 数,不多不少')
  A.deepEqual(rows.map((r) => r.url), requested, '向量 30:结果只按请求列表排列')
  A.ok(!rows.some((r) => r.url.includes('evil.test')), '向量 30:模型多回的 URL 不进档案')
  A.equal(rows[0].level, 'LIVE')
  A.equal(rows[1].level, 'UNKNOWN', '向量 29:探针缺该 URL → UNKNOWN')
  A.equal(rows[1].reason, 'not_probed')
  A.equal(rows[1].at, '', '未体检的行不许盖时间戳(否则看着像刚查过)')
  // 整体解析失败 → 全 UNKNOWN,绝不 DEAD
  const dead = T.applyProbes(requested, T.parseProbeJson('模型今天不想回 JSON'), '2026-08-15T09:03:12.000Z')
  A.deepEqual(dead.map((r) => r.level), ['UNKNOWN', 'UNKNOWN'], '解析失败一律 UNKNOWN')
}

// ── parseProbeJson:整体解析失败 → 全 UNKNOWN(不是 DEAD);level/verdict 字段被丢弃 ──
{
  const bad = T.parseProbeJson('模型今天不想回 JSON')
  A.deepEqual(bad, { ok: false, probes: [] }, '解析失败 → {ok:false}')
  for (const u of ['https://a.test/x', 'https://a.test/y']) {
    A.equal(T.verdictOf(bad.probes.find((p) => p.url === u)).level, 'UNKNOWN', '解析失败一律 UNKNOWN,绝不 DEAD')
  }
  const clean = T.parseProbeJson('```json\n{"probes":[{"url":"https://a.test/z","http":404,"exit":0,"wayback":"none"}]}\n```')
  const dirty = T.parseProbeJson('```json\n{"probes":[{"url":"https://a.test/z","http":404,"exit":0,"wayback":"none","level":"LIVE","verdict":"LIVE","confidence":0.99}]}\n```')
  A.deepEqual(dirty.probes, clean.probes, '模型多回的 level/verdict 字段必须被丢弃')
  A.deepEqual(T.verdictOf(dirty.probes[0]), T.verdictOf(clean.probes[0]), '带不带 level 字段,判定逐字相同')
  A.equal(T.verdictOf(dirty.probes[0]).level, 'LIKELY_HALLUCINATED', '判定只出自 verdictOf,不听模型的')
  A.equal(T.parseProbeJson('```json\n{"nope":1}\n```').ok, false, '没有 probes 数组 → 解析失败')
}

// ══ ③ normalizeUrl / safeHref / extractUrls ═════════════════════════════════
A.equal(T.normalizeUrl('https://Example.COM/a/?utm_source=x&fbclid=y&b=2#frag'), 'https://example.com/a?b=2', 'utm/fbclid/主机大小写/末尾斜杠/fragment 一并归一')
A.equal(T.normalizeUrl('https://example.com:443/a'), T.normalizeUrl('https://example.com/a/'), ':443 与末尾斜杠归一')
A.equal(T.normalizeUrl('http://example.com:80/'), 'http://example.com', ':80 归一')
A.equal(T.normalizeUrl('https://example.com'), T.normalizeUrl('https://example.com/'), '裸域名与末尾斜杠同一')
A.equal(T.normalizeUrl('javascript:alert(1)'), '', 'javascript: 不进源表')
A.equal(T.normalizeUrl('file:///etc/passwd'), '', 'file: 不进源表')
A.equal(T.normalizeUrl(''), '', '空串')
A.equal(T.safeHref('javascript:alert(1)'), '', 'javascript: 拒绝 href')
A.equal(T.safeHref('file:///etc/passwd'), '', 'file: 拒绝 href')
A.equal(T.safeHref('https://x.test'), 'https://x.test', 'https 放行')
{
  const u = T.extractUrls('见 https://a.test/p?utm_source=n 与 https://a.test/p/,以及 https://b.test/q。')
  A.equal(u.length, 2, '归一后判重:同一 URL 的两种写法只算一条')
  A.ok(u[1].startsWith('https://b.test/q'), '尾随中文句号被剥掉')
  A.deepEqual(T.extractUrls(''), [], '空文本')
}
// 括号 / 中文路径:抽错 URL = 判据直接反向(404 → 疑似虚构,或探到首页 → 假绿灯)
{
  const paren = T.extractUrls('见 https://en.wikipedia.org/wiki/Bayes_theorem_(statistics) 一文')
  A.deepEqual(paren, ['https://en.wikipedia.org/wiki/Bayes_theorem_(statistics)'], '配平的括号是 URL 的一部分,不许截断(截断后必 404 → 会被打成疑似虚构)')
  const wrapped = T.extractUrls('(详见 https://en.wikipedia.org/wiki/Bayes_theorem)')
  A.deepEqual(wrapped, ['https://en.wikipedia.org/wiki/Bayes_theorem'], '多出来的右括号是散文的,剥掉')
  const nested = T.extractUrls('https://a.test/x_(a)_(b) 结束')
  A.deepEqual(nested, ['https://a.test/x_(a)_(b)'], '多组配平括号全保留')
  const zh = T.extractUrls('参见 https://zh.wikipedia.org/wiki/贝叶斯定理 与 https://baike.test/item/林奈。')
  A.deepEqual(zh, ['https://zh.wikipedia.org/wiki/贝叶斯定理', 'https://baike.test/item/林奈'],
    '中文路径必须完整保留:截到 /wiki/ 会去探站点首页,拿回一个假的「可达」绿灯')
  A.equal(T.normalizeUrl('https://zh.wikipedia.org/wiki/贝叶斯定理'), T.normalizeUrl('https://zh.wikipedia.org/wiki/%E8%B4%9D%E5%8F%B6%E6%96%AF%E5%AE%9A%E7%90%86'), '中文路径与百分号编码写法归一到同一条')
  A.deepEqual(T.extractUrls('见 https://a.test/p,那么就这样'), ['https://a.test/p'], 'ASCII 标点后的中文散文剥掉')
  A.deepEqual(T.trimUrlTail('https://a.test/p).'), 'https://a.test/p', '收尾回扫确定性收敛')
}

// ══ ④ parseDossier ↔ serializeDossier 往返 ══════════════════════════════════
const FIX = [
  '---',
  'dossier_slug: why-cites-fail',
  'dossier_question: 为什么引注看着漂亮、事实层却不可靠?',
  'my_own_key: 用户自己加的键',
  'dossier_lang: zh',
  'dossier_version: 2',
  'dossier_created: 2026-08-14T02:11:00.000Z',
  'dossier_updated: 2026-08-15T09:03:12.000Z',
  'dossier_rounds: 3',
  'dossier_next_claim: 8',
  'dossier_next_source: 5',
  '---',
  '',
  '# 为什么引注看着漂亮、事实层却不可靠?',
  '',
  '## 结论摘要',
  '',
  '链接有效率与事实正确率是两件事。',
  '',
  '## 断言',
  '',
  '### C1 · 链接有效不等于事实正确',
  '正文第一行',
  '正文第二行',
  '引注:S1 S3 ｜ 支持:SUPPORTED',
  '',
  '### C7 · 工具调用越多事实正确率反而下滑',
  '```text',
  '### 这一行在围栏里,不是新断言',
  '```',
  '引注:S1 ｜ 支持:NOT_FOUND',
  '',
  '## 我自己加的一节',
  '',
  '随便写点什么,插件不许吃掉。',
  '',
  '## 证据源',
  '',
  '- S1 · Cited but Not Verified — https://arxiv.org/abs/2605.06635',
  '  - 引文:"link validity above 94%"',
  '  - 体检:LIVE · http_200 · 2026-08-15T09:02:41.000Z',
  '- S3 · DRBench — https://arxiv.org/abs/2604.03173',
  '',
  '## 未决问题',
  '',
  '- 还不知道的第一件事',
  '',
  '## 检索记录',
  '',
  '- 第 3 轮 · 2026-08-15T09:03:12.000Z · 查询:「citation hallucination」· 共 2 源 / 2 断言',
  '',
].join('\n')

const M = T.parseDossier(FIX)
A.equal(M.fm.slug, 'why-cites-fail')
A.equal(M.fm.version, 2)
A.equal(M.fm.nextClaim, 8)
A.equal(M.fm.lang, 'zh')
A.equal(M.claims.length, 2, '两条断言(围栏里的 ### 不算新断言)')
A.equal(M.claims[0].id, 'C1')
A.deepEqual(M.claims[0].cites, ['S1', 'S3'])
A.equal(M.claims[0].support, 'SUPPORTED')
A.equal(M.claims[0].body, '正文第一行\n正文第二行')
A.ok(M.claims[1].body.includes('### 这一行在围栏里'), '围栏里的文本原样留在正文')
A.equal(M.claims[1].support, 'NOT_FOUND')
A.equal(M.sources.length, 2)
A.equal(M.sources[0].url, 'https://arxiv.org/abs/2605.06635')
A.equal(M.sources[0].title, 'Cited but Not Verified')
A.equal(M.sources[0].quote, 'link validity above 94%')
A.deepEqual(M.sources[0].verdict, { level: 'LIVE', reason: 'http_200', at: '2026-08-15T09:02:41.000Z' })
A.equal(M.sources[1].verdict, null, '没有体检行的源判据为 null(= 未体检)')
A.deepEqual(M.gaps, ['还不知道的第一件事'])
A.equal(M.log.length, 1)
A.ok(M.preamble.includes('# 为什么引注'), 'H1 前言原位保留')
A.ok(M.sections.some((s) => s.key === null && s.heading === '## 我自己加的一节'), '未知 H2 小节被记下')
A.ok(M.fmLines.some((l) => l.key === 'my_own_key'), '未知 frontmatter 键被记下')
const ROUND = T.serializeDossier(M)
A.equal(ROUND, FIX, '往返必须逐字节一致')
A.equal(T.serializeDossier(T.parseDossier(ROUND)), ROUND, '再往返一次仍稳定')

// 英文章节标题也能解析(双语别名表)
A.equal(T.sectionKeyOf('## Summary'), 'summary')
A.equal(T.sectionKeyOf('## Open questions'), 'gaps')
A.equal(T.sectionKeyOf('## 证据源'), 'sources')
A.equal(T.sectionKeyOf('## Research Log'), 'log')
A.equal(T.sectionKeyOf('## 我自己加的一节'), null, '认不出就是未知小节')
{
  const EN = [
    '---', 'dossier_slug: en-one', 'dossier_question: Why do citations look fine but fail?', 'dossier_lang: en',
    'dossier_version: 1', 'dossier_created: 2026-08-14T02:11:00.000Z', 'dossier_updated: 2026-08-14T02:11:00.000Z',
    'dossier_rounds: 1', 'dossier_next_claim: 2', 'dossier_next_source: 2', '---', '',
    '# Why do citations look fine but fail?', '', '## Summary', '', 'Link validity is not factual accuracy.', '',
    '## Claims', '', '### C1 · Link validity is not accuracy', 'Body line.', 'Cites: S1 | Support: SUPPORTED', '',
    '## Sources', '', '- S1 · Cited but Not Verified — https://arxiv.org/abs/2605.06635',
    '  - Quote: "link validity above 94%"', '  - Check: LIVE · http_200 · 2026-08-15T09:02:41.000Z', '',
    '## Open questions', '', '- Still unknown', '', '## Research log', '', '- Round 1 · 2026-08-14T02:11:00.000Z · queries: "x" · 1 sources / 1 claims', '',
  ].join('\n')
  const em = T.parseDossier(EN)
  A.equal(em.claims.length, 1, '英文档案解析出断言')
  A.deepEqual(em.claims[0].cites, ['S1'])
  A.equal(em.claims[0].support, 'SUPPORTED')
  A.equal(em.sources[0].quote, 'link validity above 94%')
  A.equal(T.serializeDossier(em), EN, '英文档案往返也逐字节一致')
}

// 元数据行逐段容错
A.deepEqual(T.parseClaimMeta('引注:S1 S2 ｜ 支持:SUPPORTED'), { cites: ['S1', 'S2'], support: 'SUPPORTED', hasCites: true })
A.equal(T.parseClaimMeta('引注:S1').support, 'NOT_FOUND', '没有支持段 → 保守落 NOT_FOUND')
A.deepEqual(T.parseClaimMeta('支持:SUPPORTED').cites, [], '没有引注段 → 空引注')
A.equal(T.parseClaimMeta('支持:SUPPORTED').hasCites, false, '没有引注段要标「无引注」')
{
  const noMeta = T.parseDossier(['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '## 断言', '', '### C2 · 没有元数据行的断言', '正文还在', '', '## 证据源', '', '- S1 · T — https://a.test/1', ''].join('\n'))
  A.equal(noMeta.claims.length, 1, '整行元数据缺席也要收下断言')
  A.equal(noMeta.claims[0].body, '正文还在', '不丢正文')
  A.deepEqual(noMeta.claims[0].cites, [])
  A.equal(noMeta.claims[0].support, 'NOT_FOUND')
}
{
  const ghost = T.parseDossier(['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '## 断言', '', '### C1 · a', 'b', '引注:S1 S9 ｜ 支持:SUPPORTED', '', '## 证据源', '', '- S1 · T — https://a.test/1', ''].join('\n'))
  A.deepEqual(ghost.claims[0].cites, ['S1'], 'Sn 指向不存在的源 → 丢弃该引用,其余保留')
}
// 「元数据行」判定必须整行锚定:否则任何含「支持:」的散文末行会被当成元数据吃掉(用户手写内容永久丢失)
{
  const prose = ['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '## 断言', '', '### C1 · a', '论据一。', '反方的支持:很弱。', '', '## 证据源', '', '- S1 · T — https://a.test/1', ''].join('\n')
  const p = T.parseDossier(prose)
  A.ok(p.claims[0].body.includes('反方的支持:很弱。'), '正文末行含「支持:」的散文必须原样留在正文里,不许当元数据吃掉')
  A.ok(p.claims[0].body.includes('论据一。'), '前面的正文也不许丢')
  A.equal(p.claims[0].support, 'NOT_FOUND', '不是元数据行 → 支持度保守落 NOT_FOUND')
  A.ok(T.serializeDossier(p).includes('反方的支持:很弱。'), '回写时用户那行还在')
  A.equal(T.parseClaimMeta('支持:NOT_FOUND').support, 'NOT_FOUND', '只有支持段的真元数据行仍然认')
  const only = T.parseDossier(['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '## 断言', '', '### C1 · a', '正文', '支持:SUPPORTED', ''].join('\n'))
  A.equal(only.claims[0].support, 'SUPPORTED', '整行只有「支持:SUPPORTED」时仍按元数据收')
  A.equal(only.claims[0].body, '正文', '真元数据行不留在正文里')
  const en = T.parseDossier(['---', 'dossier_slug: x', 'dossier_lang: en', '---', '', '## Claims', '', '### C1 · a', 'body', 'Support: NOT_FOUND', ''].join('\n'))
  A.equal(en.claims[0].body, 'body', '英文侧同款')
}
// Amadeus 块标记行:跳过 + 不回写
{
  const withMark = ['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '<!-- a 1 -->', '# 标题', '', '## 结论摘要', '', '<!-- a 2 -->', '摘要正文', '', '## 断言', '', '### C1 · a', '<!-- a 3 -->', 'b', '引注:S1 ｜ 支持:SUPPORTED', '', '## 证据源', '', '<!-- a 4 -->', '- S1 · T — https://a.test/1', ''].join('\n')
  const wm = T.parseDossier(withMark)
  A.equal(wm.summary, '摘要正文', '标记行不算摘要正文')
  A.equal(wm.claims[0].body, 'b', '标记行不算断言正文')
  A.equal(wm.sources.length, 1)
  const outWm = T.serializeDossier(wm)
  A.ok(!outWm.includes('<!-- a '), '写回时块标记行必须被丢弃')
}
// 只有 frontmatter 的空档案 / EOF 无换行 / claims:[] 不崩
{
  const bare = T.parseDossier('---\ndossier_slug: empty\ndossier_lang: zh\ndossier_version: 0\n---')
  A.equal(bare.claims.length, 0)
  const out = T.serializeDossier(bare)
  A.ok(out.includes('## 断言') && out.includes('## 证据源'), '空档案补齐五节')
  A.ok(out.includes('暂无可靠断言'), 'claims:[] 产出提示而非异常')
  A.equal(out.endsWith('\n'), true, '收尾单个换行')
  A.equal(T.serializeDossier(T.parseDossier(out)), out, '空档案往返稳定')
  const noNl = T.parseDossier('---\ndossier_slug: e2\ndossier_lang: zh\n---\n\n## 结论摘要\n\n没有结尾换行')
  A.equal(noNl.summary, '没有结尾换行', 'EOF 无换行也能解析')
}
A.equal(T.parseDossier('').claims.length, 0, '空串不崩')
A.equal(T.parseDossier(null).sources.length, 0, 'null 不崩')

// ══ ⑤ reconcileClaimIds / mergeSources / diffVersions / bodyDigest ══════════
{
  const r = T.reconcileClaimIds(['C1', 'C2'], [
    { prev: 'C1', title: 'a', body: 'x', support: 'supported', cites: ['k1'] },
    { prev: 'C1', title: 'b', body: 'y', support: 'not_found', cites: [] },
    { prev: 'C9', title: 'c', body: 'z', support: 'supported', cites: ['k2'] },
    { prev: null, title: 'd', body: 'w', support: 'supported', cites: ['k1'] },
  ], 5)
  A.deepEqual(r.claims.map((c) => c.id), ['C1', 'C5', 'C6', 'C7'], 'prev 命中复用;重复/不存在/空 → 新号')
  A.equal(r.nextClaim, 8, '计数器只增')
  A.equal(r.claims[0].support, 'SUPPORTED', 'supported → ASCII 大写')
  A.equal(r.claims[1].support, 'NOT_FOUND')
  // 删掉断言后新断言不复用旧号
  const r2 = T.reconcileClaimIds([], [{ prev: null, title: 'n', body: '', support: 'supported', cites: [] }], r.nextClaim)
  A.equal(r2.claims[0].id, 'C8', '删过的号永不复用')
}
{
  const existing = [
    { id: 'S1', title: 'A', url: 'https://a.test/1', quote: 'q1', verdict: { level: 'LIVE', reason: 'http_200', at: 'T0' } },
    { id: 'S2', title: 'B', url: 'https://b.test/2', quote: '', verdict: null },
  ]
  const m = T.mergeSources(existing, [
    { key: 'k1', title: 'A2', url: 'https://a.test/1/?utm_source=n', quote: 'q1b' },
    { key: 'k2', title: 'C', url: 'https://c.test/3', quote: 'q3' },
    { key: 'k3', title: 'bad', url: 'javascript:alert(1)', quote: '' },
    { key: 'k4', title: 'blank', url: '', quote: '' },
  ], 3, { max: 40, cites: [['k1'], ['k2', 'S2']] })
  A.equal(m.keyMap.k1, 'S1', '同一 URL 两种写法合并为同一 Sn')
  A.equal(m.keyMap.k2, 'S3', '新 URL 号连续')
  A.equal(m.keyMap.k3, undefined, 'javascript: 不进源表')
  A.equal(m.keyMap.k4, undefined, '空 URL 不进源表')
  A.deepEqual(m.sources.find((s) => s.id === 'S1').verdict, { level: 'LIVE', reason: 'http_200', at: 'T0' }, '既有判据合并后必须保留')
  A.equal(m.nextSource, 4)
  const cut = T.mergeSources(m.sources, [], m.nextSource, { max: 2, cites: [['S3'], ['S3'], ['S1']] })
  A.deepEqual(cut.sources.map((s) => s.id), ['S1', 'S3'], '超 max 按被引用次数截断')
}
{
  const prev = T.parseDossier(FIX)
  const cur = T.parseDossier(FIX)
  A.deepEqual(T.diffVersions(prev, cur), { claimsAdded: [], claimsChanged: [], claimsRemoved: [], sourcesAdded: [], gapsClosed: [] }, '无变化四态之一')
  const cur2 = T.parseDossier(FIX)
  cur2.claims[0].body = '正文第一行\n\n   正文第二行  '
  A.equal(T.diffVersions(prev, cur2).claimsChanged.length, 0, '仅空白差异不算变化')
  cur2.claims[0].body = '正文改了'
  A.deepEqual(T.diffVersions(prev, cur2).claimsChanged, ['C1'], '正文变化算变化')
  const cur3 = T.parseDossier(FIX)
  cur3.claims.push({ id: 'C8', title: '新断言', body: '', cites: [], support: 'NOT_FOUND' })
  cur3.sources.push({ id: 'S5', title: 'N', url: 'https://n.test/1', quote: '', verdict: null })
  cur3.gaps = []
  const d3 = T.diffVersions(prev, cur3)
  A.deepEqual(d3.claimsAdded, ['C8'])
  A.deepEqual(d3.sourcesAdded, ['S5'], '跨版本新增源')
  A.deepEqual(d3.gapsClosed, ['还不知道的第一件事'])
  const cur4 = T.parseDossier(FIX)
  cur4.claims = cur4.claims.slice(0, 1)
  A.deepEqual(T.diffVersions(prev, cur4).claimsRemoved, ['C7'], '移除态')
}
{
  const a = T.parseDossier(FIX)
  const b = T.parseDossier(FIX)
  A.equal(T.bodyDigest(a), T.bodyDigest(b), '同内容指纹相同')
  b.sources[0].verdict = { level: 'DEAD', reason: 'http_404+wayback_found', at: 'T9' }
  A.equal(T.bodyDigest(a), T.bodyDigest(b), '指纹不含判据(体检不该 bump 版本)')
  b.summary = '换了个说法'
  A.notEqual(T.bodyDigest(a), T.bodyDigest(b), '内容变了指纹要变')
  A.deepEqual(T.healthSummary(a), { live: 1, dead: 0, suspect: 0, unknown: 1 }, '未体检的源计入 unknown')
}

// ══ ⑥ slug / agent 产出解析 ═════════════════════════════════════════════════
A.equal(T.slugifyTopic('Why do Deep Research agents fail?'), 'why-do-deep-research-agents-fail')
A.equal(T.slugifyTopic('为什么引注不可靠?'), '为什么引注不可靠')
A.equal(T.slugifyTopic(''), 'dossier', '空问题也要有兜底 slug')
A.equal(T.slugifyTopic('!!!???'), 'dossier', '全标点也要有兜底 slug')
A.equal(T.uniqueSlug('a', new Set()), 'a')
A.equal(T.uniqueSlug('a', new Set(['a'])), 'a-2', '重名加序号')
A.equal(T.uniqueSlug('a', new Set(['a', 'a-2'])), 'a-3')
{
  const good = T.parseAgentOutput('前面废话\n```dossier\n{"summary":"s","claims":[{"ref":"c1","prev":null,"title":"T","body":"B","support":"supported","cites":["k1"]}],"sources":[{"key":"k1","title":"A","url":"https://a.test/1","quote":"q"}],"gaps":["g"],"log":[{"round":1,"queries":["q1"]}]}\n```\n后面废话')
  A.equal(good.ok, true)
  A.equal(good.data.claims[0].title, 'T')
  A.equal(good.data.sources[0].url, 'https://a.test/1')
  A.deepEqual(good.data.gaps, ['g'])
  A.equal(T.parseAgentOutput('```dossier\n不是 JSON\n```').ok, false, '空 fence / 坏 JSON → 解析失败')
  A.equal(T.parseAgentOutput('').ok, false, '空输出 → 解析失败')
  // gaps 显式 [] 与键缺席必须可区分:前者=全解决(进 diff),后者=模型没说(保留既有)
  A.deepEqual(T.parseAgentOutput('```dossier\n{"summary":"s","claims":[],"sources":[],"gaps":[]}\n```').data.gaps, [], '显式空 gaps → []')
  A.equal(T.parseAgentOutput('```dossier\n{"summary":"s","claims":[],"sources":[]}\n```').data.gaps, null, 'gaps 键缺席 → null')
  {
    const keep = T.newModel('q', 'zh')
    keep.gaps = ['旧的未决问题']
    T.applyRound(keep, { summary: 's', claims: [], sources: [], gaps: null, log: [] }, 12)
    A.deepEqual(keep.gaps, ['旧的未决问题'], '模型没说 gaps 时不许抹掉既有未决问题')
    T.applyRound(keep, { summary: 's', claims: [], sources: [], gaps: [], log: [] }, 12)
    A.deepEqual(keep.gaps, [], '模型显式回空 gaps = 全解决')
  }
  A.deepEqual(T.parseAgentOutput('```dossier\n{"summary":"s","claims":[],"sources":[],"drop":["C3"," c9 ","不是id",7]}\n```').data.drop, ['C3', 'C9'], 'drop 只认 Cn 形态,大小写与空白容错')
  A.deepEqual(T.parseAgentOutput('```dossier\n{"summary":"s","claims":[],"sources":[]}\n```').data.drop, [], 'drop 键缺席 → 空数组(什么都不删)')
}

// ══ ⑥b 续研合流:断言是**增量**,模型没重报的旧断言必须活着 ══════════════════
// 这是最贵的失败模式:指令里从没有一句要求模型把要保留的旧断言原样重抄,
// 任何按字面理解、第二轮只回新断言的模型都会让上一轮的断言与引注凭空消失。
{
  const mk = () => {
    const m = T.newModel('增量续研', 'zh')
    T.applyRound(m, {
      summary: '第一轮答案。',
      claims: [
        { ref: 'c1', prev: null, title: '断言一', body: '正文一', support: 'supported', cites: ['k1'] },
        { ref: 'c2', prev: null, title: '断言二', body: '正文二', support: 'supported', cites: ['k2'] },
      ],
      sources: [
        { key: 'k1', title: 'A', url: 'https://a.test/1', quote: 'qa' },
        { key: 'k2', title: 'B', url: 'https://b.test/2', quote: 'qb' },
      ],
      gaps: [], log: [],
    }, 12)
    return m
  }
  // ① 第二轮只回一条**全新**断言 → C1/C2 必须还在,新的拿 C3
  const only = mk()
  A.deepEqual(only.claims.map((c) => c.id), ['C1', 'C2'])
  T.applyRound(only, {
    summary: '', claims: [{ ref: 'c9', prev: null, title: '断言三', body: '正文三', support: 'supported', cites: ['k3'] }],
    sources: [{ key: 'k3', title: 'C', url: 'https://c.test/3', quote: 'qc' }], gaps: null, log: [],
  }, 12)
  A.deepEqual(only.claims.map((c) => c.id), ['C1', 'C2', 'C3'], '模型没重报的旧断言必须原样活着')
  A.equal(only.claims[0].title, '断言一', '旧断言的标题不许被抹')
  A.deepEqual(only.claims[0].cites, ['S1'], '旧断言的引注不许被抹')
  A.equal(only.claims[0].support, 'SUPPORTED', '旧断言的支持度不许被降级')
  // ② prev 命中 = 就地替换,其余仍保留
  const rep = mk()
  T.applyRound(rep, {
    summary: '', claims: [{ ref: 'c1', prev: 'C1', title: '断言一改', body: '新正文', support: 'not_found', cites: [] }],
    sources: [], gaps: null, log: [],
  }, 12)
  A.deepEqual(rep.claims.map((c) => c.id), ['C1', 'C2'], '替换不产生新号,也不吃掉别的断言')
  A.equal(rep.claims[0].title, '断言一改')
  A.equal(rep.claims[1].title, '断言二', '没被提到的 C2 原样保留')
  // ③ 只有显式 drop 才移除,并出现在 diff 的 claimsRemoved 里
  const dropped = mk()
  const beforeDrop = T.parseDossier(T.serializeDossier(dropped))
  T.applyRound(dropped, { summary: '', claims: [], drop: ['C1'], sources: [], gaps: null, log: [] }, 12)
  A.deepEqual(dropped.claims.map((c) => c.id), ['C2'], 'drop 里点名的断言才移除')
  A.deepEqual(T.diffVersions(beforeDrop, dropped).claimsRemoved, ['C1'], '移除要能在 diff 面板看见')
  // ④ 空转轮(模型解析成功但一条断言都没给):既有内容一个字都不许动,指纹不变 → 不 bump 不写
  const empty = mk()
  const digestBefore = T.bodyDigest(empty)
  T.applyRound(empty, { summary: '', claims: [], sources: [], gaps: null, log: [] }, 12)
  A.equal(empty.claims.length, 2, '空转轮不许清空断言')
  A.equal(T.bodyDigest(empty), digestBefore, '空转轮指纹不变 → 不 bump 版本、不写文件')
  // ⑤ 空壳替换(prev 命中但标题正文全空)不许把旧断言洗白
  const husk = mk()
  T.applyRound(husk, { summary: '', claims: [{ ref: 'c1', prev: 'C1', title: '', body: '', support: 'not_found', cites: [] }], sources: [], gaps: null, log: [] }, 12)
  A.equal(husk.claims[0].title, '断言一', '空壳替换保留旧内容')
  // ⑥ maxSources 截断必须把**保留下来的旧断言**的引用算进去,否则连带丢掉已有判据
  const cut = mk()
  cut.sources[0].verdict = { level: 'LIVE', reason: 'http_200', at: '2026-08-10T00:00:00.000Z' }
  T.applyRound(cut, {
    summary: '', claims: [{ ref: 'c9', prev: null, title: '断言三', body: '正文三', support: 'supported', cites: ['k3'] }],
    sources: [{ key: 'k3', title: 'C', url: 'https://c.test/3', quote: 'qc' }], gaps: null, log: [],
  }, 2)
  A.equal(cut.sources.length, 2, 'maxSources 生效')
  A.ok(cut.sources.some((s) => s.id === 'S1'), '被旧断言引用的源不许当成「无人引用」砍掉')
  A.equal((cut.sources.find((s) => s.id === 'S1') || {}).verdict.level, 'LIVE', '连带保住已有判据')
  // ⑦ 指令段必须把这套契约讲清楚(否则模型仍会整份重报,白白烧 token)
  const proto = T.buildResearchMessage(only, 3, 12)
  A.ok(proto.includes('"drop"'), '指令段要教模型怎么删断言')
  A.ok(proto.includes('DELTA'), '指令段要写明 claims 是增量')
  A.ok(proto.includes('kept unchanged') || proto.includes('survives untouched'), '指令段要写明没提到的断言会被保留')
}

// ══ ⑦ 日期(TZ 扫描 + 跨年 + 历史文件名排序) ════════════════════════════════
A.equal(T.padVersion(9), 'v0009')
A.equal(T.padVersion(10), 'v0010')
A.equal([T.padVersion(9), T.padVersion(10), T.padVersion(2)].sort()[0], T.padVersion(2), '零填充四位后字典序排序稳定')
A.ok(T.padVersion(9) < T.padVersion(10), '零填充后字典序即版本序')
for (const tz of ['UTC', 'Asia/Shanghai', 'Europe/London', 'America/New_York']) {
  process.env.TZ = tz
  const ms = Date.parse('2026-08-15T09:03:12.000Z')
  const d = new Date(ms)
  const expect = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  A.equal(T.dayKeyOf(ms), expect, `${tz}:dayKeyOf 用本地日历日`)
  loc = 'zh'
  const zh = T.fmtDate('2025-12-31T20:00:00.000Z')
  loc = 'en'
  const en = T.fmtDate('2025-12-31T20:00:00.000Z')
  A.ok(zh && en, `${tz}:跨年日期两语都要出串`)
  A.notEqual(zh, en, `${tz}:中英日期格式必须不同`)
  loc = 'zh'
}
process.env.TZ = 'Asia/Shanghai'
A.equal(T.fmtDate('not a date'), '', '坏日期给空串')
A.equal(T.fmtDate(''), '', '空日期给空串')

// ══ ⑧ XSS ══════════════════════════════════════════════════════════════════
{
  const box = mkEl('div')
  T.renderMarkdown(box, '**hi** <img src=x onerror=alert(1)> `code`\n\n[good](https://x.test) [bad](javascript:evil)')
  A.ok(textOf(box).includes('<img') && textOf(box).includes('onerror'), '注入 HTML 应作为字面文字保留')
  A.equal(findAll(box, 'img').length, 0, '绝不创建 img 元素')
  A.equal(anyAttr(box, 'onerror'), false, '绝不设 onerror 属性')
  const as = findAll(box, 'a')
  A.equal(as[0].attrs.href, 'https://x.test', '安全链接设 href')
  A.equal(as[1].attrs.href, undefined, '危险协议不设 href')
}
{
  const box = mkEl('div')
  T.renderMarkdown(box, '# H\n\n- a\n- b\n\n```\n<script>alert(1)</script>\n```')
  A.equal(findAll(box, 'h1').length, 1)
  A.equal(findAll(findAll(box, 'ul')[0], 'li').length, 2)
  A.equal(findAll(box, 'script').length, 0, '代码块里的 script 不许变成元素')
  A.ok(textOf(box).includes('<script>'), 'script 串作为字面文字保留')
}
{
  // 恶意串走完整档案渲染路径:源标题 <script> / URL javascript:
  const evil = T.parseDossier(['---', 'dossier_slug: x', 'dossier_lang: zh', '---', '', '## 断言', '', '### C1 · <img src=x onerror=alert(1)>', '<script>alert(2)</script>', '引注:S1 ｜ 支持:SUPPORTED', '', '## 证据源', '', '- S1 · <script>bad</script> — javascript:alert(3)', ''].join('\n'))
  const box = mkEl('div')
  T.renderMarkdown(box, evil.claims[0].body)
  A.equal(findAll(box, 'script').length, 0)
  A.equal(anyAttr(box, 'onerror'), false)
  A.equal(T.safeHref(evil.sources[0].url), '', '源 URL 为 javascript: 时不给 href')
  A.equal(T.normalizeUrl(evil.sources[0].url), '', 'javascript: 源不进判重表')
}

// ══ ⑨ 双语 ═════════════════════════════════════════════════════════════════
{
  const zk = Object.keys(T.MSG.zh).sort()
  const ek = Object.keys(T.MSG.en).sort()
  A.deepEqual(zk, ek, '双语词表两侧键集合必须完全相等')
  A.ok(zk.length > 60, '词表条目数应覆盖 SPEC 点名的全部文案')
  for (const k of zk) {
    A.equal(typeof T.MSG.zh[k], 'string', `zh.${k} 应为字符串`)
    A.equal(typeof T.MSG.en[k], 'string', `en.${k} 应为字符串`)
    A.ok(T.MSG.zh[k].trim() && T.MSG.en[k].trim(), `${k} 两侧都不许空`)
    const zv = (T.MSG.zh[k].match(/\{[a-z]+\}/g) || []).sort().join(',')
    const ev = (T.MSG.en[k].match(/\{[a-z]+\}/g) || []).sort().join(',')
    A.equal(zv, ev, `${k} 两侧占位符必须一致`)
    A.ok(!/[一-鿿]/.test(T.MSG.en[k]), `en.${k} 不许残留中文`)
  }
  loc = 'zh'
  A.equal(T.t('btn_start'), '开研')
  A.equal(T.t('col_version', { n: 3 }), '第 3 版')
  loc = 'en'
  A.equal(T.t('btn_start'), 'Research')
  A.equal(T.t('col_version', { n: 3 }), 'v3')
  A.equal(T.t('nonexistent_key_xyz'), 'nonexistent_key_xyz', '缺键回落键名而不是崩')
  loc = 'zh'
  // 占位符必须**单趟**替换:逐个 split/join 时,先替进去的值会被后一轮再扫一遍 ——
  // 用户数据里出现 `{msg}` 之类的字样就会被当成占位符二次吃掉(BRIEF 2026-08-14 实测)。
  A.equal(T.t('{a}-{b}', { a: '{b}', b: 'X' }), '{b}-X', 't() 必须单趟替换:替进去的值不许被后一轮再当占位符')
  A.equal(T.t('save_failed', { msg: '路径 {n} 打不开' }), T.MSG.zh.save_failed.replace('{msg}', '路径 {n} 打不开'), '用户数据里的花括号原样保留')
  A.equal(T.t('col_version', {}), T.MSG.zh.col_version, '没给值的占位符原样留着,不许渲染成 undefined')
}
// BRIEF 点名的两个「两道门禁都不覆盖」的洞:zh → en → zh 往返漂移 / 切语言吃掉正在输入的内容
{
  loc = 'zh'
  const el = mkEl('div')
  const off = T.mountDesk(el)
  await tick()
  const before = textOf(el)
  setLocale('en')
  setLocale('zh')
  A.equal(textOf(el), before, 'zh → en → zh 往返后整棵视图文本必须与初始逐字相同(单向门禁看不见漂移)')
  const ta = findAll(el, 'textarea')[0]
  A.ok(ta, '课题台应有问题输入框')
  typeInto(ta, '我正在写的问题')
  setLocale('en')
  A.equal(findAll(el, 'textarea')[0].value, '我正在写的问题', '切语言不许吃掉草稿框里没提交的内容')
  setLocale('zh')
  off()
}
{
  // 正在编辑的源码框是**每次重渲新建**的,是语言切换的重灾区:必须回填 dirty,不是磁盘原文
  const p = '深研档案馆/编辑中.dossier.md'
  vault.set(p, '---\ndossier_slug: 编辑中\ndossier_lang: zh\n---\n\n# 磁盘原文\n')
  loc = 'zh'
  const el = mkEl('div')
  const off = T.mountDossierFile(el, p)
  await tick()
  clickEl(btnBy(el, T.MSG.zh.btn_edit_source))
  typeInto(findAll(el, 'textarea')[0], '我改了一半还没保存的源码')
  setLocale('en')
  A.equal(findAll(el, 'textarea')[0].value, '我改了一半还没保存的源码', '切语言不许把编辑中的源码打回磁盘原文')
  setLocale('zh')
  off()
  vault.delete(p)
}
// 切 UI 语言绝不重写档案文件
{
  const m = T.parseDossier(FIX)
  loc = 'zh'
  const a = T.serializeDossier(m)
  loc = 'en'
  const b = T.serializeDossier(m)
  loc = 'zh'
  A.equal(a, b, '切 UI 语言前后 serializeDossier 输出必须逐字节相同')
}
// mock ctx 切 en 后,插件重渲的文本里出现英文串(不重挂视图)
{
  loc = 'zh'
  const el = mkEl('div')
  const off = T.mountDesk(el)
  await tick()
  const zhText = textOf(el)
  A.ok(zhText.includes('还没有档案'), `中文空态应可见,实得:${zhText.slice(0, 120)}`)
  A.ok(zhText.includes('开研'), '中文按钮可见')
  setLocale('en')
  const enText = textOf(el)
  A.ok(enText.includes('No dossiers yet'), `切 en 后应出现英文空态,实得:${enText.slice(0, 120)}`)
  A.ok(enText.includes('Research'), '切 en 后按钮变英文')
  A.ok(!enText.includes('还没有档案'), '切 en 后中文文案应消失')
  setLocale('zh')
  off()
}
{
  loc = 'zh'
  const el = mkEl('div')
  const off = T.mountRun(el)
  await tick()
  A.ok(textOf(el).includes('检索台空着'), 'run 视图零数据也有可见中文内容')
  setLocale('en')
  A.ok(textOf(el).includes('Nothing running'), 'run 视图切 en 后变英文')
  A.ok(textOf(el).includes('Search'), '步骤条也跟着变英文')
  setLocale('zh')
  off()
}
// 取消按钮必须在**引注体检**期间也是活的:自动体检发生在 run.running 已经置 false 之后,
// 只看 run.running 的话整段体检既显示不出可取消,controller 也已经置空。
{
  loc = 'zh'
  T.run.running = false
  T.run.probeRunning = true
  T.run.probes = [{ url: 'https://a.test/1', host: 'a.test', level: '', reason: 'not_probed', at: '' }]
  const el = mkEl('div')
  const off = T.mountRun(el)
  await tick()
  const cancel = findAll(el, 'button').find((b) => textOf(b) === T.MSG.zh.btn_cancel)
  A.ok(cancel, '检索台应有取消按钮')
  A.equal(cancel.disabled, false, '体检进行中时取消按钮必须可点')
  T.run.probeRunning = false
  T.run.probes = []
  off()
}
// 错误 / 判据 / 步骤这些「运行期文案」也必须跟着语言走(存词表键,不存已渲染的串)
{
  loc = 'zh'
  T.run.errorKey = 'parse_failed'
  T.run.errorVars = null
  T.run.error = ''
  T.run.probeErrorKey = 'check_failed'
  T.run.probes = [{ url: 'https://a.test/1', host: 'a.test', level: 'LIKELY_HALLUCINATED', reason: 'dns_fail+wayback_none', at: '2026-08-15T09:02:41.000Z' }]
  const el = mkEl('div')
  const off = T.mountRun(el)
  await tick()
  const zh = textOf(el)
  A.ok(zh.includes('解析失败'), '中文错误文案可见')
  A.ok(zh.includes('疑似虚构链接'), '中文判据显示名可见')
  A.ok(zh.includes('引注体检'), '体检面板标题可见')
  setLocale('en')
  const en = textOf(el)
  A.ok(en.includes('Parse failed'), `错误文案必须跟着语言走,实得:${en.slice(0, 140)}`)
  A.ok(en.includes('Likely fabricated'), '判据显示名必须跟着语言走')
  A.ok(!en.includes('解析失败') && !en.includes('疑似虚构'), '切 en 后不许残留中文运行期文案')
  A.equal(T.errText(), T.MSG.en.parse_failed, 'errText 按当前语言取串')
  A.equal(T.probeErrText(), T.MSG.en.check_failed, 'probeErrText 按当前语言取串')
  setLocale('zh')
  off()
  T.run.errorKey = ''
  T.run.probeErrorKey = ''
  T.run.probes = []
}
// 状态栏项是数据驱动的(handle.update),必须跟着语言走 —— 它不是命令面板那种单字符串缺口
{
  loc = 'zh'
  T.run.running = false
  rerenderAllViaLocale('zh')
  A.ok(reg.status[0].text.includes('档案'), `状态栏中文态,实得 ${reg.status[0].text}`)
  rerenderAllViaLocale('en')
  A.ok(/dossiers/.test(reg.status[0].text), `状态栏必须跟着语言走,实得 ${reg.status[0].text}`)
  A.ok(!/[一-鿿]/.test(reg.status[0].text), '英文状态栏不许残留中文')
  rerenderAllViaLocale('zh')
}

// ══ ⑩ 数据契约往返(写→读→再写不丢字段;历史快照 + 索引) ═══════════════════
{
  vault.clear()
  writes.length = 0
  const model = T.newModel('为什么引注不可靠?', 'zh')
  T.applyRound(model, {
    summary: '当前答案。',
    claims: [{ ref: 'c1', prev: null, title: '链接有效不等于事实正确', body: '正文\n第二行', support: 'supported', cites: ['k1'] }],
    sources: [{ key: 'k1', title: 'Cited but Not Verified', url: 'https://arxiv.org/abs/2605.06635', quote: 'link validity above 94%' }],
    gaps: ['还不知道的第一件事'],
    log: [{ round: 1, queries: ['citation hallucination'] }],
  }, 12)
  A.equal(model.claims[0].id, 'C1')
  A.deepEqual(model.claims[0].cites, ['S1'], '模型局部键 k1 被翻译成稳定 S1')
  A.equal(model.fm.rounds, 1)
  const first = await T.persistModel(model, { bump: true, snapshotText: '' })
  A.ok(vault.has('深研档案馆/为什么引注不可靠.dossier.md'), '档案落在工作文件夹')
  A.ok(vault.has('深研档案馆/.dossier-index.json'), '索引落盘')
  A.equal(model.fm.version, 1)
  const idx1 = JSON.parse(vault.get('深研档案馆/.dossier-index.json'))
  A.equal(idx1.items[0].slug, '为什么引注不可靠')
  A.equal(idx1.items[0].claims, 1)
  A.deepEqual(idx1.items[0].health, { live: 0, dead: 0, suspect: 0, unknown: 1 })

  // 写 → 读 → 再写不丢字段
  const reread = T.parseDossier(first)
  A.equal(T.serializeDossier(reread), first, '写→读→再写逐字节一致')
  A.equal(reread.fm.question, '为什么引注不可靠?')
  A.equal(reread.sources[0].quote, 'link validity above 94%')

  // 第二轮 + 历史快照
  const before = first
  T.applyRound(reread, {
    summary: '更新后的答案。',
    claims: [
      { ref: 'c1', prev: 'C1', title: '链接有效不等于事实正确', body: '正文\n第二行', support: 'supported', cites: ['k1'] },
      { ref: 'c2', prev: null, title: '工具调用越多正确率越低', body: '新正文', support: 'not_found', cites: [] },
    ],
    sources: [{ key: 'k1', title: 'Cited but Not Verified', url: 'https://arxiv.org/abs/2605.06635?utm_source=x', quote: '' }],
    gaps: [],
    log: [{ round: 2, queries: ['tool calls accuracy'] }],
  }, 12)
  A.deepEqual(reread.claims.map((c) => c.id), ['C1', 'C2'], '续研复用 C1、新断言拿 C2')
  A.equal(reread.sources.length, 1, '带 utm 的同一 URL 不产生第二个源')
  await T.persistModel(reread, { bump: true, snapshotText: before })
  A.equal(vault.get('深研档案馆/.history/为什么引注不可靠/v0001.dossier.md'), before, '快照存的是旧版全文')
  A.equal(reread.fm.version, 2)
  const prevModel = T.parseDossier(vault.get('深研档案馆/.history/为什么引注不可靠/v0001.dossier.md'))
  const cur = T.parseDossier(vault.get('深研档案馆/为什么引注不可靠.dossier.md'))
  const d = T.diffVersions(prevModel, cur)
  A.deepEqual(d.claimsAdded, ['C2'], '同一解析器跑快照与当前文件得出 diff')
  A.deepEqual(d.gapsClosed, ['还不知道的第一件事'])

  // bodyDigest 相同 → 不 bump 版本、不写文件(幂等)
  const wBefore = writes.length
  const same = T.parseDossier(vault.get('深研档案馆/为什么引注不可靠.dossier.md'))
  A.equal(T.bodyDigest(same), T.bodyDigest(cur), '内容未变指纹相同')
  A.equal(writes.length, wBefore, '指纹相同就不该有新写入')
}

// 建在笔记附件夹里的档案:索引记真实 path,课题台照样找得到
{
  const made = await T.createDossier('放在笔记旁边的课题', 'Notes/研究.fd')
  A.equal(made.path, 'Notes/研究.fd/放在笔记旁边的课题.dossier.md', '带 folder 时落在该文件夹')
  A.ok(vault.has(made.path), '档案落盘')
  const idx = await T.readIndex()
  const row = idx.items.find((x) => x.slug === made.slug)
  A.ok(row, '附件夹里的档案也要进索引(否则课题台看不到、续研会找错路径)')
  A.equal(row.path, made.path, '索引记的是真实 path')
  const back = T.parseDossier(vault.get(made.path))
  A.equal(back.fm.question, '放在笔记旁边的课题')
  A.equal(back.fm.version, 0, '刚建档还没有版本')
}
// 重名课题:slug 加序号,绝不覆写既有档案
{
  const a = await T.createDossier('重名课题')
  const b = await T.createDossier('重名课题')
  A.notEqual(a.slug, b.slug, '重名课题必须拿到不同 slug')
  A.equal(b.slug, `${a.slug}-2`)
  A.ok(vault.has(a.path) && vault.has(b.path), '两份档案都在,谁也没被覆写')
}
// 「slug 被占了吗」的判据必须是**磁盘**,不是索引 —— 否则「移出列表」(只删索引条目、保留文件)
// 之后重开同名课题,会把原档案连同全部断言/证据源/判据一个空壳覆盖掉,零提示零快照零回滚。
{
  const a = await T.createDossier('索引之外也不许覆写')
  vault.set(a.path, `${vault.get(a.path)}\n\n## 断言\n\n### C1 · 一条重要断言\n必须活下来\n引注: ｜ 支持:NOT_FOUND\n`)
  const keepText = vault.get(a.path)
  // 用户点了「移出列表」:索引里没了,文件还在(README 明写不删文件)
  const idx = await T.readIndex()
  idx.items = idx.items.filter((x) => x.slug !== a.slug)
  vault.set('深研档案馆/.dossier-index.json', JSON.stringify({ v: 1, items: idx.items }, null, 2))
  A.ok(!(await T.readIndex()).items.some((x) => x.slug === a.slug), '前置条件:索引里已经没有这条了')
  const b = await T.createDossier('索引之外也不许覆写')
  A.notEqual(b.path, a.path, '索引里没有条目,也不许拿同一个 path 建新档')
  A.equal(vault.get(a.path), keepText, '原档案一个字节都不许被覆写')
  A.ok(T.parseDossier(vault.get(a.path)).claims.some((c) => c.id === 'C1'), '原档案的断言还在')
  // 手工拷进来的档案(从未进过索引)同样受保护
  vault.set('深研档案馆/手工拷进来的.dossier.md', '---\ndossier_slug: 手工拷进来的\n---\n\n# 手工档案\n')
  const c = await T.createDossier('手工拷进来的')
  A.notEqual(c.path, '深研档案馆/手工拷进来的.dossier.md', '磁盘上已有的同名档案不许被新建覆写')
  A.ok(vault.get('深研档案馆/手工拷进来的.dossier.md').includes('# 手工档案'), '手工档案原样还在')
}
// readFile 抛错时拿不准这个 path 上有没有东西 → 宁可不建,绝不冒覆写的险
{
  readThrows = true
  const wBefore = writes.length
  const r = await T.createDossier('IO 故障时不许瞎写')
  readThrows = false
  A.equal(r, null, 'readFile 抛错 → 建档中止')
  A.equal(writes.length, wBefore, '建档中止时零写入')
}
// 空问题拒绝建档
{
  const wBefore = writes.length
  A.equal(await T.createDossier('   '), null, '空问题拒绝建档')
  A.equal(writes.length, wBefore, '拒绝建档时零写入')
}

// 体检失败绝不降级已存判据(node 无引擎 → probeUrls 一路走到 ok:false)
{
  const made = await T.createDossier('体检失败也不许动判据')
  const m = T.parseDossier(vault.get(made.path))
  m.sources = [{ id: 'S1', title: 'A', url: 'https://a.test/1', quote: '', verdict: { level: 'LIVE', reason: 'http_200', at: '2026-08-10T00:00:00.000Z' } }]
  await T.persistModel(m, { path: made.path })
  const snapshot = vault.get(made.path)
  const wBefore = writes.length
  await T.checkDossier(made.slug, { quiet: true, path: made.path })
  A.equal(vault.get(made.path), snapshot, '体检失败时档案文件一个字节都不许变')
  A.equal(writes.length, wBefore, '体检失败零写入')
  A.equal(T.parseDossier(vault.get(made.path)).sources[0].verdict.level, 'LIVE', '既有判据保留')
  A.ok(T.run.probeErrorKey || T.run.probeError, '体检失败要在检索台留下原因')
  A.equal(T.run.probeErrorKey, 'no_engine', '无引擎的失败原因存的是词表键(切语言才跟得上)')
  A.equal(T.run.probeRunning, false, '失败后必须复位运行态')
}

// 索引 JSON 损坏 → 生成 .bak 且不清空档案
{
  vault.set('深研档案馆/.dossier-index.json', '{{{ 坏掉的 JSON')
  const idx = await T.readIndex()
  A.deepEqual(idx.items, [], '损坏索引重置为空')
  A.equal(vault.get('深研档案馆/.dossier-index.json.bak'), '{{{ 坏掉的 JSON', '原件必须备份为 .bak,绝不静默清空')
  A.ok(vault.has('深研档案馆/为什么引注不可靠.dossier.md'), '档案文件不受索引损坏影响')
}
// readFile 抛错 → 中止本次操作,零写入
{
  readThrows = true
  const wBefore = writes.length
  let threw = false
  try { await T.readIndex() } catch (e) { threw = true; A.equal(e.ioFail, true, '读失败要带 ioFail 标记') }
  A.equal(threw, true, 'readFile 抛错必须原样上抛')
  A.equal(writes.length, wBefore, '读失败时零写入')
  readThrows = false
}

// ══ ⑪ 指令段与报告(发给模型的一律英文;判定不许交给模型) ═══════════════════
{
  const m = T.parseDossier(FIX)
  const msg = T.buildResearchMessage(m, 3, 12)
  A.ok(!/[一-鿿]/.test(msg.replace(m.fm.question, '').replace(/C\d+: [^\n]*/g, '').replace(/S\d+: [^\n]*/g, '').replace(/- [^\n]*/g, '')), '指令段骨架必须全英文')
  A.ok(msg.includes('Respond in Chinese.'), 'dossier_lang=zh → 显式要求中文输出')
  A.ok(msg.includes('```dossier'), '指定 fence')
  A.ok(msg.includes('Never emit S-numbers'), '禁止模型编 id')
  A.ok(msg.includes('Do NOT create, write or modify any file'), '禁止模型写文件')
  m.fm.lang = 'en'
  A.ok(T.buildResearchMessage(m, 3, 12).includes('Respond in English.'), 'dossier_lang=en → 显式要求英文输出')
  const pm = T.buildProbeMessage(['https://a.test/1'])
  A.ok(!/[一-鿿]/.test(pm), '体检指令段必须全英文')
  A.ok(pm.includes('run_bash ONLY'), '只许 run_bash')
  A.ok(pm.includes('Do not read or write any file'), '不许写文件')
  A.ok(pm.includes('archive.org/wayback/available'), '要查 Wayback')
  A.ok(pm.includes('the plugin decides the verdict, not you'), '明确判定不归模型')
}
{
  T.run.probes = [{ url: 'https://a.test/1', host: 'a.test', level: 'LIKELY_HALLUCINATED', reason: 'http_404+wayback_none', at: '2026-08-15T09:03:12.000Z' }]
  T.run.noteName = '研究'
  const rep = T.probeReportMarkdown()
  A.ok(rep.includes('LIKELY_HALLUCINATED'), '报告落 ASCII 判据 token')
  A.ok(rep.includes('https://a.test/1'))
  T.run.probes = []
}

// ══ ⑫ stageOf / STEPS ══════════════════════════════════════════════════════
A.deepEqual(T.stageOf({ type: 'status', payload: { state: 'queued' } }, ''), { pct: 10, key: 'st_queued' })
A.equal(T.stageOf({ type: 'tool_call', payload: { name: 'web_fetch' } }, '').key, 'st_searching')
A.equal(T.stageOf({ type: 'token', payload: {} }, 'x'.repeat(60000)).pct, 86, 'token 阶段封顶 86')
A.equal(T.stageOf({ type: 'unknown' }, ''), null)
A.deepEqual(T.STEPS.map((s) => s[1]), [6, 20, 62, 88, 96], '步骤百分比按 SPEC')
for (const s of T.STEPS) A.ok(T.MSG.zh[s[0]] && T.MSG.en[s[0]], `步骤 ${s[0]} 两语都有文案`)

// ══ ⑬ 旧宿主 ctx:两个各自独立的 mock ═══════════════════════════════════════
globalThis.__DOSSIER_TEST__ = undefined
{
  // ① 缺席版:07-18 之后的面全删,且无 getLocale / subscribeLocale
  const r = { views: [], commands: [], settings: [], creators: [], slash: [] }
  const old = {
    registerView: (v) => r.views.push(v),
    registerCommand: (c) => r.commands.push(c),
    registerSetting: (s) => r.settings.push(s),
    registerTheme: () => {},
    registerPropertyType: () => {},
    app: {
      notify: () => {},
      readFile: async () => null,
      writeFile: async () => {},
      getActivePage: () => null,
      getActivePageText: () => '',
    },
  }
  let d
  A.doesNotThrow(() => { d = new Function('ctx', src)(old) }, '缺席版旧宿主 setup 不许抛')
  A.equal(r.views.length, 2, '缺席版仍注册两个视图')
  A.equal(r.commands.length, 4, '缺席版仍注册四条命令')
  A.equal(r.creators.length, 0)
  A.equal(r.slash.length, 0)
  A.equal(typeof d, 'function', '缺席版仍返回 disposer')
  A.doesNotThrow(() => d(), '缺席版 disposer 执行不抛')
  await tick()
}
{
  // ② 退让版:registerFileType 存在但返回 false → creator / slash 注册数为 0
  const r = { views: [], commands: [], settings: [], creators: [], slash: [], embeds: [] }
  const refuse = {
    registerView: (v) => r.views.push(v),
    registerCommand: (c) => r.commands.push(c),
    registerSetting: (s) => r.settings.push(s),
    registerFileType: () => false,
    registerFileCreator: (c) => r.creators.push(c),
    registerSlashItem: (s) => r.slash.push(s),
    registerEmbedRenderer: (e) => r.embeds.push(e),
    registerStatusItem: () => ({ update() {}, dispose() {} }),
    notify: () => {},
    activity: { log: () => {} },
    achievements: { registerSeries: () => {}, track: () => {} },
    openView: () => {},
    getLocale: () => 'zh',
    subscribeLocale: () => () => {},
    app: {
      notify: () => {}, workFolder: () => 'X', readFile: async () => null, writeFile: async () => {},
      openFile: () => {}, getActivePage: () => null, getActivePageText: () => '', prompt: async () => null,
    },
  }
  let d
  A.doesNotThrow(() => { d = new Function('ctx', src)(refuse) }, '退让版 setup 不许抛')
  A.equal(r.creators.length, 0, 'registerFileType 返回 false 时必须整体退让:0 个 fileCreator')
  A.equal(r.slash.length, 0, '0 个 slashItem')
  A.equal(r.embeds.length, 0, '0 个 embedRenderer')
  A.equal(r.views.length, 2, '视图数不变')
  A.equal(r.commands.length, 4, '命令数不变')
  A.doesNotThrow(() => d(), '退让版 disposer 执行不抛')
  await tick()
}
globalThis.__DOSSIER_TEST__ = T

// ══ ⑬a 有引擎时的整条链(fetch 桩):续研落盘 → 自动体检 → 进度收尾 ═════════
// 前面所有「无引擎」的断言都跑完了才装桩,装完立刻拆,免得污染别的向量。
{
  const prevLoc = globalThis.location
  const prevFetch = globalThis.fetch
  globalThis.location = { origin: 'http://engine.test' }
  localStorage.setItem('forsion_token', 'tok')
  const enc = new TextEncoder()
  const sse = (evts) => {
    let i = 0
    return { getReader: () => ({ read: async () => (i < evts.length ? { done: false, value: enc.encode(`data: ${JSON.stringify(evts[i++])}\n`) } : { done: true }) }) }
  }
  // 模型这一轮**只回一条新断言**(既不重报 C1,也不 drop 它)—— 最贵的那个失败模式
  const RESEARCH_OUT = '```dossier\n' + JSON.stringify({
    summary: '第二轮答案。',
    claims: [{ ref: 'c2', prev: null, title: '新断言', body: '新正文', support: 'supported', cites: ['k2'] }],
    sources: [{ key: 'k2', title: 'B', url: 'https://b.test/new', quote: 'qb' }],
    gaps: ['还没查清的'], log: [{ round: 2, queries: ['q'] }],
  }) + '\n```'
  const PROBE_OUT = '```json\n' + JSON.stringify({
    probes: [
      { url: 'https://a.test/old', http: 200, final: 'https://a.test/old', exit: 0, wayback: 'found' },
      { url: 'https://b.test/new', http: 404, final: 'https://b.test/new', exit: 0, wayback: 'none' },
    ],
  }) + '\n```'
  let researchOut = RESEARCH_OUT
  let probeSnapshot = null
  let lastMessage = ''
  const posts = []
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/agent/runs')) {
      const body = JSON.parse(init.body)
      lastMessage = String(body.message || '')
      if (lastMessage.includes('run_bash ONLY')) { probeSnapshot = { pct: T.run.pct, stage: T.run.stageKey } }
      posts.push(body)
      return { ok: true, json: async () => ({ runId: 'r1' }) }
    }
    const out = lastMessage.includes('run_bash ONLY') ? PROBE_OUT : researchOut
    return {
      ok: true,
      body: sse([
        { seq: 1, type: 'status', payload: { state: 'running' } },
        { seq: 2, type: 'token', payload: { delta: out } },
        { seq: 3, type: 'done', payload: { content: out } },
      ]),
    }
  }

  const made = await T.createDossier('整条链走一遍')
  const seed = T.parseDossier(vault.get(made.path))
  T.applyRound(seed, {
    summary: '第一轮答案。',
    claims: [{ ref: 'c1', prev: null, title: '旧断言', body: '旧正文', support: 'supported', cites: ['k1'] }],
    sources: [{ key: 'k1', title: 'A', url: 'https://a.test/old', quote: 'qa' }],
    gaps: null, log: [],
  }, 12)
  await T.persistModel(seed, { bump: true, path: made.path })
  A.equal(T.parseDossier(vault.get(made.path)).fm.version, 1, '前置:第一版已落盘')
  const v1Text = vault.get(made.path)

  await T.runResearch(made.slug, { path: made.path })
  const after = T.parseDossier(vault.get(made.path))
  A.deepEqual(after.claims.map((c) => c.id), ['C1', 'C2'], '真跑一轮:模型没重报的 C1 必须还在磁盘上')
  A.equal(after.claims[0].title, '旧断言', 'C1 的内容原样')
  A.deepEqual(after.claims[0].cites, ['S1'], 'C1 的引注原样')
  A.equal(after.fm.version, 2, '有新内容 → bump 到第 2 版')
  A.equal(vault.get(`深研档案馆/.history/${made.slug}/v0001.dossier.md`), v1Text, '旧版全文进 .history 快照')
  A.equal(after.sources.length, 2, '新源合并进来')
  A.equal(T.run.pct, 100, '整条链(含自动体检)跑完才到 100%')
  A.equal(T.run.running, false)
  A.equal(T.run.probeRunning, false)
  // 自动体检:判定只出自 verdictOf,模型只给了原始探测数据
  A.equal((after.sources.find((s) => s.url === 'https://a.test/old') || {}).verdict.level, 'LIVE', '自动体检把判据贴回档案')
  A.equal((after.sources.find((s) => s.url === 'https://b.test/new') || {}).verdict.level, 'LIKELY_HALLUCINATED', '404 + 档案馆 none → 疑似虚构')
  A.equal(T.run.probes.length, 2, '体检面板逐源列出')
  // 进度条不许在写着「逐条请求链接中」的同时显示 100%:100% 留给整条链真正结束
  A.ok(probeSnapshot, '自动体检确实发生了')
  A.equal(probeSnapshot.stage, 'st_probing', '体检阶段的文案是「逐条请求链接中」')
  A.ok(probeSnapshot.pct < 100, `体检进行中进度条不许已经是 100%,实得 ${probeSnapshot.pct}%`)
  A.ok(posts.some((p) => p.agent_config && p.agent_config.execMode === 'host'), '两条 run 都走 host 模式')
  A.ok(posts.every((p) => p.app_id === 'tangu'), 'app_id 恒 tangu')
  A.ok(posts.every((p) => p.model_id === undefined), '绝不写死模型名(cfg 没给就不传)')

  // 空转轮(模型解析成功但一条断言都没给:超时空转 / 拒答):既有断言绝不许被清空,
  // 指纹不变 → 不 bump 版本、不写文件、不落一句「暂无可靠断言」。
  researchOut = '```dossier\n' + JSON.stringify({ summary: '', claims: [], sources: [], log: [] }) + '\n```'
  const wBefore = writes.length
  const notesBefore = notes.length
  await T.runResearch(made.slug, { path: made.path })
  const still = T.parseDossier(vault.get(made.path))
  A.deepEqual(still.claims.map((c) => c.id), ['C1', 'C2'], '空转轮不许把断言清空')
  A.equal(still.fm.version, 2, '空转轮不许 bump 版本')
  A.equal(writes.length, wBefore, '空转轮一个字节都不写')
  A.ok(!vault.get(made.path).includes('暂无可靠断言'), '空转轮不许把档案洗成「暂无可靠断言」')
  A.ok(notes.slice(notesBefore).some((x) => x[0].includes('这一轮没有带来新内容')), '空转轮要如实告诉用户')
  researchOut = RESEARCH_OUT

  // 写盘失败(队列体里 reject):必须落成一条通知,不许变成未捕获 rejection(真机门禁第 10 项)
  {
    const before = notes.length
    writeThrows = true
    await T.checkDossier(made.slug, { path: made.path })
    writeThrows = false
    await tick()
    const added = notes.slice(before)
    A.ok(added.some((x) => x[1] === 'error' && x[0].includes('EIO write simulated')), `体检写盘失败要给出可读通知,实得:${JSON.stringify(added)}`)
    A.deepEqual(unhandled.map(String), [], '体检写盘失败不许留下未捕获 rejection')
    A.equal(T.parseDossier(vault.get(made.path)).fm.version, 2, '写盘失败时档案不受影响')
  }

  globalThis.fetch = prevFetch
  if (prevLoc === undefined) delete globalThis.location
  else globalThis.location = prevLoc
  localStorage.removeItem('forsion_token')
  T.run.probes = []
  T.run.pct = 0
  T.run.stageKey = ''
  T.run.diff = null
  T.run.stream = ''
}

// ══ ⑬b UI 入口的失败面:取消 prompt / 缺失文件 / 清空源码 / 未捕获 rejection ══
{
  // prompt 按 Esc → null。曾经 `q || t('ask_question')` 会拿提示语本身建一份垃圾档案并落盘
  promptReply = null
  const wBefore = writes.length
  await reg.fileCreators[0].run('Notes')
  A.equal(writes.length, wBefore, '右键新建时取消 prompt → 零写入,绝不建「你要研究的问题」这种垃圾档案')
  A.ok(!vault.has(`深研档案馆/${T.slugifyTopic(T.MSG.zh.ask_question)}.dossier.md`), '提示语本身不许变成课题')
  const inserted = await reg.slash[0].run({ folder: 'Notes' })
  A.equal(inserted, '', '斜杠项取消 prompt → 不插入任何内容')
  A.equal(writes.length, wBefore, '斜杠项取消 prompt → 零写入')
  promptReply = '   '
  await reg.fileCreators[0].run('Notes')
  A.equal(writes.length, wBefore, '只敲空白也算没写问题')
  promptReply = '右键建的课题'
  await reg.fileCreators[0].run('Notes')
  A.ok(vault.has('Notes/右键建的课题.dossier.md'), '正常输入才建档,并落在右键的那个文件夹')
  promptReply = null
}
{
  // 文件缺失(readFile → null)不许折叠成「空文件」:那样点保存会把空串写回去
  const el = mkEl('div')
  const off = T.mountDossierFile(el, '深研档案馆/根本不存在.dossier.md')
  await tick()
  A.ok(textOf(el).includes('读取失败'), `文件缺失要走错误分支,实得:${textOf(el).slice(0, 120)}`)
  A.ok(!btnBy(el, T.MSG.zh.btn_save), '文件缺失时不许给出保存入口')
  off()
}
{
  // 把源码清空后保存:写回去的必须是空串本身,而不是被 `dirty || text` 静默还原的旧内容
  const p = '深研档案馆/清空测试.dossier.md'
  vault.set(p, '---\ndossier_slug: 清空测试\ndossier_lang: zh\n---\n\n# 旧内容\n')
  const el = mkEl('div')
  const off = T.mountDossierFile(el, p)
  await tick()
  clickEl(btnBy(el, T.MSG.zh.btn_edit_source))
  const ta = findAll(el, 'textarea')[0]
  A.ok(ta, '源码模式应有 textarea')
  A.ok(ta.value.includes('# 旧内容'), '源码框先装磁盘原文')
  typeInto(ta, '')
  clickEl(btnBy(el, T.MSG.zh.btn_save))
  await tick()
  A.equal(vault.get(p), '', '用户清空源码后保存,删除不许被静默撤销')
  off()
}
{
  // 「引注全部可达」的成就说的是 5 **份**档案,不是体检了 5 次
  const before = reg.events.filter((e) => e[0] === 'clean_cites').length
  T.markCleanCites('干净的甲')
  T.markCleanCites('干净的甲')
  T.markCleanCites('干净的甲')
  T.markCleanCites('干净的乙')
  A.equal(reg.events.filter((e) => e[0] === 'clean_cites').length - before, 2, '同一份档案重复体检只算一次')
}
{
  // 会落盘的兜底默认名不许取 t():拿不到笔记名时,中英两种界面必须写到**同一个**报告路径
  const prevPage = ctxMock.app.getActivePage
  ctxMock.app.getActivePage = () => ''
  const paths = []
  for (const l of ['zh', 'en']) {
    loc = l
    await T.cmdCheckNote() // 无引擎 → 体检提前返回,但 noteName 这时已经定下来了
    T.run.probes = [{ url: 'https://a.test/1', host: 'a.test', level: 'LIVE', reason: 'http_200', at: '' }]
    const before = writes.length
    await T.saveProbeReport()
    A.equal(writes.length, before + 1, '「另存报告」应落盘一次')
    paths.push(writes[writes.length - 1])
  }
  loc = 'zh'
  ctxMock.app.getActivePage = prevPage
  A.equal(paths[0], paths[1], `没有笔记名时体检报告路径不许随界面语言变,实得 ${paths[0]} vs ${paths[1]}`)
  // 界面上的兜底显示仍然要跟着语言走(落盘的那半钉死,显示的那半本地化)
  T.run.probeScope = 'note'
  T.run.noteName = ''
  const el = mkEl('div')
  const off = T.mountRun(el)
  await tick()
  A.ok(textOf(el).includes(T.MSG.zh.src_of_note), '没有笔记名时面板显示中文兜底')
  setLocale('en')
  A.ok(textOf(el).includes(T.MSG.en.src_of_note), '兜底显示跟着语言走')
  setLocale('zh')
  off()
  T.run.probeScope = ''
  T.run.probes = []
}
{
  // fire():UI 入口的统一收尾 —— 同步抛与异步 reject 都落成一条通知,不留未捕获 rejection
  const before = notes.length
  T.fire(() => Promise.reject(new Error('boom')))
  T.fire(() => { throw new Error('sync boom') })
  await tick()
  const added = notes.slice(before)
  A.equal(added.length, 2, '两种失败都要给用户一条可读通知')
  A.ok(added.every((x) => x[1] === 'error'), '失败通知是 error 级')
  A.ok(added.some((x) => x[0].includes('boom')), '通知里带上原因')
}

// ══ ⑭ disposer ═════════════════════════════════════════════════════════════
{
  const subsBefore = localeSubs.size
  A.ok(subsBefore >= 1, '主 mock 应订阅了语言变更')
  T.run.controller = new AbortController()
  // 体检 / 找回档案也是在飞的 SSE 流,跑完还会 writeFile 进用户库(宿主 revokeSurface 拦不住 IO 面)
  T.run.probeRunning = true
  T.run.probeController = new AbortController()
  T.run.recoverController = new AbortController()
  A.doesNotThrow(() => dispose(), 'disposer 执行不抛')
  A.equal(T.run.controller && T.run.controller.signal.aborted, true, 'disposer 应 abort 进行中的 run')
  A.equal(T.run.probeController.signal.aborted, true, 'disposer 应 abort 进行中的引注体检(否则它跑完还会写盘)')
  A.equal(T.run.recoverController.signal.aborted, true, 'disposer 应 abort 进行中的找回档案')
  T.run.probeRunning = false
  A.equal(localeSubs.size, subsBefore - 1, 'disposer 应退订语言变更')
  A.equal(reg.statusDisposed, true, 'disposer 应摘掉状态栏项')
  A.doesNotThrow(() => dispose(), 'disposer 幂等')
}

// ══ ⑮ 源码扫描 ═════════════════════════════════════════════════════════════
A.ok(!/color:\s*#[0-9a-f]{3,8}/i.test(src), 'CSS 里不许写死前景色(强调色上的字一律 var(--ds-on-fill))')
A.ok(!/background:\s*#[0-9a-f]{3,8}/i.test(src), 'CSS 里不许写死背景色')
A.ok(!/\.innerHTML|insertAdjacentHTML|outerHTML/.test(src), '绝不使用 innerHTML / insertAdjacentHTML / outerHTML')
A.ok(!/console\.(error|warn)\(/.test(src), '任何路径都不许 console.error / console.warn(真机门禁第 11 项)')
A.ok(!/setInterval\(/.test(src), '轮询用 setTimeout 自排程,禁 setInterval')
A.ok(!/10\.7%|4\.8%/.test(src), '禁止引用 RESEARCH 里那条【未验证】数字')
A.ok(!/vaultRoot/.test(src), '本插件不碰 vaultRoot(敏感绝对路径)')
A.ok(/new Date\(Date\.now\(\)\)/.test(src), '「现在」一律 Date.now() 推导')
{
  const lines = src.split('\n')
  const asi = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*[([]/.test(lines[i])) continue
    let p = i - 1
    while (p >= 0 && !lines[p].trim()) p -= 1
    if (p >= 0 && /[)\]'"`\w]\s*$/.test(lines[p])) asi.push(i + 1)
  }
  A.equal(asi.length, 0, `以 ( [ 开头的行会被 ASI 粘到上一句:第 ${asi.join(',')} 行`)
}
{
  const mf = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
  A.equal(mf.id, 'dossier')
  A.equal(mf.apiVersion, 1)
  A.equal(mf.version, '1.1.1')
  A.ok(mf.nameEn && mf.descriptionEn, 'manifest 需带 nameEn / descriptionEn')
  A.deepEqual(mf.fileExtensions, ['.dossier.md'], 'fileExtensions 必须与 registerFileType 逐字一致')
  A.deepEqual(mf.events.map((e) => e.name).sort(), ['cites_checked', 'research_done'], 'manifest events 按 SPEC')
  A.ok(mf.onboarding && mf.onboarding.en && Array.isArray(mf.onboarding.en.steps), 'onboarding 需带 en')
  A.equal(mf.onboarding.en.steps.length, mf.onboarding.steps.length, 'en steps 与中文一一对应')
  A.ok(!mf.onboarding.recommends, 'onboarding 禁止 recommends 自家内嵌内容')
  const sp = JSON.parse(readFileSync(new URL('./spaces/dossier/space.json', import.meta.url), 'utf8'))
  A.equal(sp.id, 'dossier')
  A.equal(sp.icon, 'briefcase', 'Space 图标须在 26 白名单内')
  A.ok(sp.name.zh && sp.name.en, 'Space 名双语')
  A.deepEqual(sp.requires.views.sort(), ['plugin:dossier:desk', 'plugin:dossier:run'], '引用到的视图都要进 requires.views')
  A.deepEqual(sp.layout.main.map((x) => x.type), ['plugin:dossier:run'])
  A.deepEqual(sp.layout.left.map((x) => x.type), ['plugin:dossier:desk'])
  A.deepEqual(sp.layout.right.map((x) => x.type), ['chat'])
  const skill = readFileSync(new URL('./skills/dossier-format/SKILL.md', import.meta.url), 'utf8')
  // 正文一律英文;中文只许出现在代码/行内码里(那是磁盘格式的字面 token,不是给模型读的散文)
  const prose = skill.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  A.ok(!/[一-鿿]/.test(prose), `给模型看的 SKILL.md 散文一律英文,残留:${(prose.match(/[一-鿿]+/g) || []).slice(0, 3).join('/')}`)
  A.ok(skill.startsWith('---\nname: dossier-format\n'), 'SKILL.md frontmatter 顶层单行 key: value')
  A.ok(skill.includes('LIKELY_HALLUCINATED'), '技能须写清 ASCII 判据值')
  A.ok(!/10\.7%|4\.8%/.test(skill), 'SKILL.md 不得出现被禁数字')
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8')
  A.ok(!/10\.7%|4\.8%/.test(readme), 'README 不得出现被禁数字')
  A.ok(readme.includes('重启'), 'README 须写明命令面板标题的已知缺口')
  const changelog = readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8')
  A.ok(changelog.includes('## 1.0.0'), 'CHANGELOG 需有 1.0.0 一节')
}

// ══ ⑯ 全程未捕获 rejection(真机门禁第 10 项在 node 侧的等价物) ═════════════
await tick()
await tick()
A.deepEqual(unhandled.map((e) => String((e && e.message) || e)), [], '任何路径都不许留下未捕获 promise rejection')

// ── 统一左栏列表源(1.1.0):注册 + 订阅即重读 + 读失败保留上一份 + open 交给档案文件视图 ──
// ⚠️「订阅即重读」是这条接缝的头号坑:插件在宿主**启动期**装载,那时活动库还没恢复,
//    ctx.app.readFile 静默给 null → 列表定格为空且此后无人再喊它(青鸟 2026-08-28 实报)。
{
  const LS = reg.listSources.find((x) => x.id === 'dossier-list')
  A.ok(LS, '应注册 dossier-list 列表源')
  for (const id of ['desk', 'run']) {
    A.equal(reg.views.find((v) => v.id === id).workspaceSource, 'dossier-list', `${id} 视图应声明 workspaceSource(裸源 id)`)
  }
  const idxKey = '深研档案馆/.dossier-index.json'
  const before = vault.get(idxKey)
  vault.set(idxKey, JSON.stringify({ v: 1, items: [
    { slug: 'a-topic', path: '深研档案馆/a-topic.dossier.md', question: '订阅后才读得到的课题', version: 2, updated: '2026-08-28T03:00:00.000Z' },
    { slug: 'b-topic', path: '深研档案馆/b-topic.dossier.md', question: '另一个课题', version: 1, updated: '2026-08-27T03:00:00.000Z' },
  ] }))
  A.ok(!LS.items({}).some((r) => r.key === '深研档案馆/a-topic.dossier.md'), '前提:此刻列表源还没读过这份新索引')
  const off = LS.subscribe(() => {})
  await new Promise((r) => setTimeout(r, 10))
  const rows = LS.items({})
  A.ok(rows.some((r) => r.key === '深研档案馆/a-topic.dossier.md'), 'subscribe() 必须触发一次重读,否则启动期读空的列表永远回不来')
  A.equal(rows.length, 2, '重读后就是索引里那两行')
  A.equal(rows[0].title, '订阅后才读得到的课题', '行标题取课题问句')
  A.equal(rows[0].hint, '2026-08-28', 'hint 取更新日期(语言中立,不进词表)')
  A.equal(rows[0].icon, 'bookmark', '行首图标与 .dossier.md 文件类型同一枚词表键')
  A.deepEqual(LS.items({ query: '另一个' }).map((r) => r.key), ['深研档案馆/b-topic.dossier.md'], '搜索匹配课题问句')
  // 索引读失败(readIndex 抛 ioFail)必须保留上一份,不许清空成「没有课题」
  readThrows = true
  await LS.subscribe(() => {})()
  await new Promise((r) => setTimeout(r, 10))
  readThrows = false
  A.equal(LS.items({}).length, 2, '索引读失败保留上一份列表,绝不清空')
  const openedFiles = []
  const realOpenFile = ctxMock.app.openFile
  ctxMock.app.openFile = (p) => openedFiles.push(p)
  LS.open({ key: '深研档案馆/a-topic.dossier.md' })
  ctxMock.app.openFile = realOpenFile
  A.deepEqual(openedFiles, ['深研档案馆/a-topic.dossier.md'], 'open() 应把档案交给文件类型视图(不是系统默认程序)')
  A.equal(typeof off, 'function', 'subscribe() 须返回退订函数')
  off()
  if (before === undefined) vault.delete(idxKey); else vault.set(idxKey, before)
}

console.log(`check ok — ${reg.views.length} views / ${reg.commands.length} cmds / ${reg.settings.length} settings;判据 30 向量 + 契约往返 + XSS + 双语 + 旧宿主两版 + 统一左栏列表源 断言通过`)
