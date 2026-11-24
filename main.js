/**
 * 深研档案馆 dossier —— Forsion 桌面插件(裸 setup(ctx) 体,宿主 new Function('ctx', code) 装载)。
 *
 * 丢进一个你还没有答案的问题 → Agent 多轮检索 → 库里落成一份 `.dossier.md` 档案:
 * 每条断言配引注、每条 URL 真的被机器请求过(四级判据 LIVE/DEAD/LIKELY_HALLUCINATED/UNKNOWN)、
 * 同一课题可续研并与上一版 diff。课题索引 `.dossier-index.json` 只负责发现,字段全部可从档案重算。
 *
 * 铁律:
 * - **判定只出自纯函数 `verdictOf`**;模型只回原始探测数据,它输出的任何 level/verdict 字段一律丢弃。
 * - 语义层只说 SUPPORTED / NOT_FOUND,**绝不输出「假」**;LIKELY_HALLUCINATED 只描述 URL 可达性。
 * - 一切读-改-写走串行写队列;写序 ①.history 快照 →②.dossier.md →③索引;bodyDigest 相同则零写入。
 * - 安全:模型/用户产出文本只走 createElement + textContent(无 innerHTML 不可信面)。
 * - 双语:UI 走 ctx.getLocale/subscribeLocale 即时重渲;**档案文件按 dossier_lang 落盘,切 UI 语言不改文件**。
 * - 时间:「现在」一律 Date.now();无周期定时器(check 冻钟可测)。
 */
const PLUGIN_ID = 'dossier'
const APP_ID = 'tangu'

// ── 双语词表(两侧键集合必须完全相等;check.mjs 断言) ─────────────────────────
const MSG = {
  zh: {
    view_desk: '深研档案馆',
    view_run: '检索台',
    desk_title: '深研档案馆',
    desk_sub: '丢进一个你还没有答案的问题,Agent 查完落成一份带引注的档案。',
    q_placeholder: '你想弄清楚的问题…',
    btn_start: '开研',
    btn_continue: '续研',
    btn_check: '体检',
    btn_open: '打开档案',
    btn_forget: '移出列表',
    btn_recover: '找回档案',
    btn_cancel: '取消',
    btn_recheck: '重新体检',
    btn_save_report: '另存报告',
    btn_edit_source: '编辑源码',
    btn_read: '阅读视图',
    btn_save: '保存',
    btn_retry: '重试',
    btn_dismiss: '知道了',
    btn_save_raw: '另存原始输出',
    btn_open_run: '打开检索台',
    desk_empty_title: '还没有档案',
    desk_empty_body: '在上面写一个你还没有答案的问题,点「开研」。已有的档案文件可以用下面的「找回档案」收编。',
    list_title: '课题',
    loading: '加载中…',
    err_load: '读取课题索引失败',
    col_version: '第 {n} 版',
    col_claims: '断言 {n}',
    col_sources: '证据源 {n}',
    run_title: '检索台',
    run_idle_title: '检索台空着',
    run_idle_body: '从课题台开一次研究,或跑命令「深研档案馆:体检当前笔记的链接」。',
    step_submit: '提交',
    step_search: '检索',
    step_draft: '起草',
    step_check: '体检',
    step_save: '落盘',
    st_queued: '排队中',
    st_running: '准备中',
    st_searching: '检索中',
    st_reading: '读取来源',
    st_drafting: '起草档案中',
    st_probing: '逐条请求链接中',
    st_done: '完成',
    stream_title: '模型输出',
    cites_title: '引注体检',
    cites_empty: '这份档案还没有体检过链接。',
    cites_count: '共 {n} 条链接',
    diff_title: '自上次以来',
    diff_added: '新增断言 {n}',
    diff_changed: '变化 {n}',
    diff_removed: '移除 {n}',
    diff_src: '新增证据源 {n}',
    diff_none: '与上一版内容相同,没有产生新版本。',
    v_live: '可达',
    v_dead: '已失效',
    v_suspect: '疑似虚构链接',
    v_unknown: '未判定',
    v_unchecked: '未体检',
    tip_live: '这个地址刚刚请求得到。',
    tip_dead: '这个地址请求不到,但互联网档案馆存过它 —— 链接腐烂,不是编造。',
    tip_suspect: '这个地址请求不到,而且互联网档案馆从未见过它。',
    tip_unknown: '证据不足(访问控制 / 服务器错误 / 超时 / 档案馆没答复),不下判断。',
    tip_unchecked: '本次没有拿到这条链接的数据,保留上次结论。',
    sup_yes: '已找到支持证据',
    sup_no: '未找到支持证据',
    no_cites: '无引注',
    health: '可达 {live} · 失效 {dead} · 疑似虚构 {suspect} · 未判定 {unknown}',
    sec_summary: '结论摘要',
    sec_claims: '断言',
    sec_sources: '证据源',
    sec_gaps: '未决问题',
    sec_log: '检索记录',
    empty_claims: '本轮没有得出可靠断言。',
    set_rounds: '检索轮数上限',
    set_rounds_desc: '一次深研最多让 Agent 检索几轮(1–6)',
    set_autocheck: '落盘后自动体检引注',
    set_autocheck_desc: '每次深研写完档案后,自动把新的 URL 逐条请求一遍',
    set_max: '每份档案保留的证据源上限',
    set_max_desc: '超出后按被引用次数截断(3–40)',
    cmd_open: '深研档案馆:打开',
    cmd_new: '深研档案馆:开一个新课题',
    cmd_continue: '深研档案馆:续研上次的课题',
    cmd_checknote: '深研档案馆:体检当前笔记的链接',
    slash_label: '深研档案',
    slash_hint: '.dossier.md',
    creator_label: '新建深研档案',
    filetype_title: '深研档案',
    ask_question: '你要研究的问题',
    need_question: '先写下你要研究的问题。',
    no_engine: '没有连接到 Tangu 引擎,当前只能查看已有档案。',
    need_login: '请先登录 Forsion。',
    busy: '已经有一轮在跑了,先等它跑完或取消。',
    canceled: '已取消',
    parse_failed: '解析失败:模型没有给出可用的档案数据。',
    raw_saved: '原始输出已另存:{path}',
    research_done: '深研完成:第 {n} 版',
    research_nochange: '这一轮没有带来新内容,档案保持第 {n} 版。',
    check_done: '引注体检完成:{n} 条链接',
    check_failed: '引注体检失败,已保留上次判据。',
    no_urls: '没有找到可体检的链接。',
    no_active: '当前没有打开的笔记。',
    no_last: '还没有打开过课题,请先去课题台开一个。',
    removed: '已移出列表(档案文件仍在库里)。',
    recovered: '找回 {n} 份档案。',
    recover_fail: '找回失败:{msg}',
    saved: '已保存',
    save_failed: '保存失败:{msg}',
    read_failed: '读取失败:{msg}',
    index_reset: '课题索引损坏,已备份为 .bak 并重置(档案文件未受影响)。',
    parse_warn: '这份档案没有完整解析,仍可编辑源码后保存。',
    confirm_remove: '输入 y 确认把它移出列表(不会删除文件)',
    ach_series: '深研档案馆',
    ach_first: '第一份档案',
    ach_first_d: '完成一次深研',
    ach_ten: '十份档案',
    ach_ten_d: '累计完成 10 次深研',
    ach_deep: '刨根问底',
    ach_deep_d: '累计 20 轮续研',
    ach_clean: '干净的引注',
    ach_clean_d: '5 份档案的引注全部可达',
    status_idle: '档案 {n}',
    status_run: '检索中 · {pct}%',
    status_tip: '打开深研档案馆',
    note_report_head: '「深研档案馆」链接体检报告',
    note_report_src: '来源笔记',
    report_saved: '报告已存:{path}',
    urls_found: '找到 {n} 条链接',
    src_of_note: '当前笔记',
  },
  en: {
    view_desk: 'Dossier',
    view_run: 'Research Desk',
    desk_title: 'Dossier',
    desk_sub: 'Drop in a question you have no answer to; the agent researches it into a cited dossier.',
    q_placeholder: 'A question you want answered…',
    btn_start: 'Research',
    btn_continue: 'Continue',
    btn_check: 'Verify links',
    btn_open: 'Open dossier',
    btn_forget: 'Remove from list',
    btn_recover: 'Rediscover dossiers',
    btn_cancel: 'Cancel',
    btn_recheck: 'Re-verify',
    btn_save_report: 'Save report',
    btn_edit_source: 'Edit source',
    btn_read: 'Reading view',
    btn_save: 'Save',
    btn_retry: 'Retry',
    btn_dismiss: 'Dismiss',
    btn_save_raw: 'Save raw output',
    btn_open_run: 'Open research desk',
    desk_empty_title: 'No dossiers yet',
    desk_empty_body: 'Type a question you have no answer to above, then hit Research. Existing dossier files can be picked up with Rediscover below.',
    list_title: 'Topics',
    loading: 'Loading…',
    err_load: 'Could not read the topic index',
    col_version: 'v{n}',
    col_claims: 'Claims {n}',
    col_sources: 'Sources {n}',
    run_title: 'Research desk',
    run_idle_title: 'Nothing running',
    run_idle_body: 'Start a run from the topic desk, or use the command "Dossier: Verify links in this note".',
    step_submit: 'Submit',
    step_search: 'Search',
    step_draft: 'Draft',
    step_check: 'Verify',
    step_save: 'Save',
    st_queued: 'Queued',
    st_running: 'Starting',
    st_searching: 'Searching',
    st_reading: 'Reading sources',
    st_drafting: 'Drafting',
    st_probing: 'Probing links one by one',
    st_done: 'Done',
    stream_title: 'Model output',
    cites_title: 'Citation check',
    cites_empty: 'No links have been verified for this dossier yet.',
    cites_count: '{n} links',
    diff_title: 'Since last time',
    diff_added: '{n} claims added',
    diff_changed: '{n} changed',
    diff_removed: '{n} removed',
    diff_src: '{n} new sources',
    diff_none: 'Identical to the previous version — no new version was written.',
    v_live: 'Live',
    v_dead: 'Dead',
    v_suspect: 'Likely fabricated',
    v_unknown: 'Unknown',
    v_unchecked: 'Not checked',
    tip_live: 'This URL responded just now.',
    tip_dead: 'This URL does not respond, but the Internet Archive has snapshots of it — link rot, not fabrication.',
    tip_suspect: 'This URL does not respond, and the Internet Archive has never seen it.',
    tip_unknown: 'Not enough evidence (access control / server error / timeout / no answer from the archive). No verdict.',
    tip_unchecked: 'This run returned no data for this URL, so the previous verdict is kept.',
    sup_yes: 'Supported by a source',
    sup_no: 'No supporting source found',
    no_cites: 'No citation',
    health: 'Live {live} · Dead {dead} · Suspect {suspect} · Unknown {unknown}',
    sec_summary: 'Summary',
    sec_claims: 'Claims',
    sec_sources: 'Sources',
    sec_gaps: 'Open questions',
    sec_log: 'Research log',
    empty_claims: 'No reliable claim came out of this round.',
    set_rounds: 'Maximum research rounds',
    set_rounds_desc: 'How many search rounds one run may take (1-6)',
    set_autocheck: 'Verify citations after saving',
    set_autocheck_desc: 'After each run, request every new URL once to check that it is real',
    set_max: 'Maximum sources kept per dossier',
    set_max_desc: 'Beyond this, the least-cited sources are dropped (3-40)',
    cmd_open: 'Dossier: Open',
    cmd_new: 'Dossier: New research topic',
    cmd_continue: 'Dossier: Continue last topic',
    cmd_checknote: 'Dossier: Verify links in this note',
    slash_label: 'Dossier',
    slash_hint: '.dossier.md',
    creator_label: 'New dossier',
    filetype_title: 'Dossier',
    ask_question: 'The question you want researched',
    need_question: 'Write down the question you want researched first.',
    no_engine: 'Not connected to a Tangu engine — you can only browse existing dossiers.',
    need_login: 'Sign in to Forsion first.',
    busy: 'A run is already in flight — wait for it or cancel it.',
    canceled: 'Canceled',
    parse_failed: 'Parse failed — the model returned no usable dossier data.',
    raw_saved: 'Raw output saved to {path}',
    research_done: 'Research done — version {n}',
    research_nochange: 'This round added nothing new; the dossier stays at version {n}.',
    check_done: 'Citation check done — {n} links',
    check_failed: 'Citation check failed; the previous verdicts were kept.',
    no_urls: 'No link to verify was found.',
    no_active: 'No note is open right now.',
    no_last: 'No topic has been opened yet — start one on the topic desk.',
    removed: 'Removed from the list (the file is still in your vault).',
    recovered: 'Recovered {n} dossiers.',
    recover_fail: 'Rediscovery failed: {msg}',
    saved: 'Saved',
    save_failed: 'Could not save: {msg}',
    read_failed: 'Could not read: {msg}',
    index_reset: 'The topic index was corrupt; it was backed up as .bak and reset (dossier files untouched).',
    parse_warn: 'This dossier did not fully parse; you can still edit and save the raw source.',
    confirm_remove: 'Type y to remove it from the list (the file is not deleted)',
    ach_series: 'Dossier',
    ach_first: 'First dossier',
    ach_first_d: 'Finish one research run',
    ach_ten: 'Ten dossiers',
    ach_ten_d: 'Finish 10 research runs',
    ach_deep: 'Down the rabbit hole',
    ach_deep_d: 'Run 20 follow-up rounds',
    ach_clean: 'Clean citations',
    ach_clean_d: '5 dossiers whose citations are all reachable',
    status_idle: '{n} dossiers',
    status_run: 'Researching · {pct}%',
    status_tip: 'Open Dossier',
    note_report_head: 'Dossier link check report',
    note_report_src: 'Source note',
    report_saved: 'Report saved to {path}',
    urls_found: '{n} links found',
    src_of_note: 'Current note',
  },
}
const L = () => {
  try { return ctx.getLocale && ctx.getLocale() === 'en' ? 'en' : 'zh' } catch { return 'zh' }
}
function t(k, vars) {
  const d = MSG[L()] || MSG.zh
  const s = d[k] != null ? d[k] : (MSG.zh[k] != null ? MSG.zh[k] : k)
  // 占位符必须**单趟**正则替换。逐个 split/join 是错的:先替进去的值会被后面那一轮再扫一遍 ——
  // 课题问题、文件路径、引擎报错里只要出现 `{msg}` 之类的字样,用户自己的数据就会被当成占位符吃掉。
  // 未知占位符原样留着(宁可显示 `{x}`,也不显示 undefined)。
  return vars ? s.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m)) : s
}

// ── 小工具 ───────────────────────────────────────────────────────────────────
const say = (m, o) => { try { if (ctx.notify) ctx.notify(m, o); else ctx.app.notify(m) } catch { /* ignore */ } }
const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const getLS = (k, d) => { try { const v = localStorage.getItem(`plugin.${PLUGIN_ID}.${k}`); return v == null ? d : v } catch { return d } }
const setLS = (k, v) => { try { localStorage.setItem(`plugin.${PLUGIN_ID}.${k}`, String(v)) } catch { /* ignore */ } }
const wfRoot = () => {
  try { return ctx.app && ctx.app.workFolder ? ctx.app.workFolder() : '深研档案馆' } catch { return '深研档案馆' }
}
const dossierPath = (slug) => `${wfRoot()}/${slug}.dossier.md`
const indexPath = () => `${wfRoot()}/.dossier-index.json`
const historyDir = (slug) => `${wfRoot()}/.history/${slug}`
const reportDir = () => `${wfRoot()}/体检`
const numSetting = (key, dflt, lo, hi) => {
  const n = parseInt(getLS(key, String(dflt)), 10)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt
}
const roundsSetting = () => numSetting('rounds', 3, 1, 6)
const maxSourcesSetting = () => numSetting('maxSources', 12, 3, 40)
const autoCheckSetting = () => getLS('autoCheck', 'true') !== 'false'

const pad2 = (n) => String(n).padStart(2, '0')
function dayKeyOf(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function fmtDate(iso) {
  const ms = typeof iso === 'number' ? iso : Date.parse(String(iso || ''))
  if (!Number.isFinite(ms)) return ''
  try { return new Date(ms).toLocaleDateString(L() === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return new Date(ms).toISOString().slice(0, 10) }
}
const padVersion = (n) => `v${String(Math.max(0, n | 0)).padStart(4, '0')}`

function safeHref(u) {
  const s = String(u == null ? '' : u).trim()
  return /^(https?:\/\/|mailto:|#)/i.test(s) ? s : ''
}
function sanitizeFileName(name) {
  return String(name == null ? '' : name).replace(/[\\/:*?"<>|#[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 48)
}
function hostOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./i, '') } catch { return '' }
}

// ── URL 归一 / 抽取 ──────────────────────────────────────────────────────────
const JUNK_PARAM = /^(utm_[a-z_]*|fbclid|gclid|msclkid|mc_cid|mc_eid|igshid|ref_src|ref_url|spm|from|_hsenc|_hsmi|yclid|wt_zmc)$/i
/** 归一到判重键:小写主机、去 fragment、去默认端口、去追踪参数、去末尾斜杠。非 http(s) → ''。 */
function normalizeUrl(raw) {
  const s = String(raw == null ? '' : raw).trim()
  if (!s || !/^https?:\/\//i.test(s)) return ''
  let u
  try { u = new URL(s) } catch { return '' }
  const proto = String(u.protocol || '').toLowerCase()
  if (proto !== 'http:' && proto !== 'https:') return ''
  const host = String(u.hostname || '').toLowerCase()
  if (!host) return ''
  let port = String(u.port || '')
  if ((proto === 'http:' && port === '80') || (proto === 'https:' && port === '443')) port = ''
  const keep = []
  try {
    u.searchParams.forEach((v, k) => { if (!JUNK_PARAM.test(k)) keep.push([k, v]) })
  } catch { /* ignore */ }
  keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const qs = keep.map((kv) => (kv[1] === '' ? encodeURIComponent(kv[0]) : `${encodeURIComponent(kv[0])}=${encodeURIComponent(kv[1])}`)).join('&')
  let path = String(u.pathname || '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path === '/') path = ''
  return `${proto}//${host}${port ? ':' + port : ''}${path}${qs ? '?' + qs : ''}`
}
/**
 * URL 的终止字符:空白、尖括号/引号/反引号、右方括号与花括号,以及中文与全角标点。
 * **汉字本体刻意不在其中**:中文维基 / 百科的链接路径里就是汉字,把汉字排掉会把
 * `…/wiki/贝叶斯定理` 截成 `…/wiki/`,探测到的是站点首页 —— 一个比误报更隐蔽的假绿灯。
 * ASCII 右括号也不排除(`…_(statistics)` 是合法路径),改由下面的配平回扫处理。
 */
const URL_STOP = '\\s<>"\'`\\]}，。、；：！？“”‘’「」『』（）〈〉《》【】…·｜'
const HAN_TAIL = /[一-鿿]+$/
/**
 * 收尾回扫(确定性收敛,最多 24 轮):
 * ① 「ASCII 标点 + 汉字」结尾 = 上一句散文粘过来了(URL 里的中文路径前面一定是 `/` 或字母数字),剥掉;
 * ② 剥尾部 ASCII 标点;③ 右括号多于左括号时剥掉多余的那个。
 * 仍无法判定的形态:URL 后**紧跟**中文且无任何分隔符 —— 那段中文会留在链接里(README 已写明)。
 */
function trimUrlTail(u) {
  let s = String(u == null ? '' : u)
  for (let i = 0; i < 24; i++) {
    let n = s
    const han = HAN_TAIL.exec(n)
    if (han && /[.,;:!?]$/.test(n.slice(0, han.index))) n = n.slice(0, han.index)
    n = n.replace(/[.,;:!?]+$/, '')
    if (n.charAt(n.length - 1) === ')') {
      const opens = (n.match(/\(/g) || []).length
      const closes = (n.match(/\)/g) || []).length
      if (closes > opens) n = n.slice(0, -1)
    }
    if (n === s) break
    s = n
  }
  return s
}
/** 文本里的 http(s) 链接,按归一键去重,保留首次出现的原始写法。 */
function extractUrls(text) {
  const out = []
  const seen = new Set()
  const re = new RegExp(`https?://[^${URL_STOP}]+`, 'g')
  const s = String(text == null ? '' : text)
  let m
  while ((m = re.exec(s))) {
    const raw = trimUrlTail(m[0])
    const key = normalizeUrl(raw)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

// ── 四级判据(纯函数;模型只回原始探测数据,判定只出自这里) ──────────────────
const toInt = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  const n = parseInt(String(v == null ? '' : v).trim(), 10)
  return Number.isFinite(n) ? n : NaN
}
const normWayback = (v) => {
  const s = String(v == null ? '' : v).trim().toLowerCase()
  return s === 'found' || s === 'none' || s === 'error' ? s : ''
}
/** DNS 解析失败(curl exit 6)是「主机根本不存在」的强信号;连接/超时/TLS 一律不算。 */
const DNS_EXIT = 6
/**
 * probe: {url, http, final, exit, wayback:'found'|'none'|'error', waybackTs}
 * → {level: 'LIVE'|'DEAD'|'LIKELY_HALLUCINATED'|'UNKNOWN', reason}
 * 保守优先:证据不足一律 UNKNOWN,绝不误判编造。
 */
function verdictOf(probe) {
  if (!probe || !probe.url) return { level: 'UNKNOWN', reason: 'not_probed' }
  const http = toInt(probe.http)
  const exit = toInt(probe.exit)
  const wb = normWayback(probe.wayback)
  // 可达性优先:2xx 一律 LIVE,不管档案馆有没有快照(新页面本来就还没被存档)。
  if (Number.isFinite(http) && http >= 200 && http <= 299) return { level: 'LIVE', reason: `http_${http}` }
  const gone = http === 404 || http === 410
  const dnsFail = (!Number.isFinite(http) || http === 0) && exit === DNS_EXIT
  if (gone || dnsFail) {
    const why = gone ? `http_${http}` : 'dns_fail'
    if (wb === 'found') return { level: 'DEAD', reason: `${why}+wayback_found` }
    if (wb === 'none') return { level: 'LIKELY_HALLUCINATED', reason: `${why}+wayback_none` }
    // 档案馆自己 error / 字段缺失 = 解析失败,不是「缺席的正证据」
    return { level: 'UNKNOWN', reason: `${why}+wayback_unavailable` }
  }
  // 3xx 停在重定向(循环/超跳数)、401/403/405/429 访问控制、5xx 服务器错误:都不是死链证据
  if (Number.isFinite(http) && http > 0) return { level: 'UNKNOWN', reason: `http_${http}` }
  if (Number.isFinite(exit) && exit > 0) return { level: 'UNKNOWN', reason: `curl_exit_${exit}` }
  return { level: 'UNKNOWN', reason: 'no_data' }
}
const VERDICT_KEY = { LIVE: 'v_live', DEAD: 'v_dead', LIKELY_HALLUCINATED: 'v_suspect', UNKNOWN: 'v_unknown' }
const VERDICT_TIP = { LIVE: 'tip_live', DEAD: 'tip_dead', LIKELY_HALLUCINATED: 'tip_suspect', UNKNOWN: 'tip_unknown' }
const VERDICT_CLS = { LIVE: 'live', DEAD: 'dead', LIKELY_HALLUCINATED: 'suspect', UNKNOWN: 'unknown' }

/** 模型探针 JSON:只收白名单字段;**任何 level/verdict/结论字段一律丢弃**。 */
function parseProbeJson(out) {
  const s = String(out == null ? '' : out)
  let body = null
  const fence = /```(?:json)?[^\n]*\n([\s\S]*?)```/i.exec(s)
  if (fence) body = fence[1]
  if (body == null) {
    const i = s.indexOf('{')
    const j = s.lastIndexOf('}')
    if (i >= 0 && j > i) body = s.slice(i, j + 1)
  }
  if (body == null) return { ok: false, probes: [] }
  let data
  try { data = JSON.parse(body) } catch { return { ok: false, probes: [] } }
  const arr = data && Array.isArray(data.probes) ? data.probes : null
  if (!arr) return { ok: false, probes: [] }
  const probes = []
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue
    const url = String(p.url == null ? '' : p.url).trim()
    if (!url) continue
    probes.push({
      url,
      http: p.http == null ? '' : p.http,
      final: String(p.final == null ? '' : p.final),
      exit: p.exit == null ? '' : p.exit,
      wayback: normWayback(p.wayback),
      waybackTs: String(p.waybackTs == null ? '' : p.waybackTs),
    })
  }
  return { ok: true, probes }
}

// ── `.dossier.md` 数据契约 ───────────────────────────────────────────────────
// Amadeus 块标记行:manifest fileExtensions 已把 .dossier.md 排出页面编译器,正常不出现;
// 遗留文件里若有,解析时跳过、写回时丢弃。
const MARKER_LINE = /^<!--\s*a\s+[A-Za-z0-9_-]+\s*-->\s*$/
const HEAD_ZH = { summary: '结论摘要', claims: '断言', sources: '证据源', gaps: '未决问题', log: '检索记录' }
const HEAD_EN = { summary: 'Summary', claims: 'Claims', sources: 'Sources', gaps: 'Open questions', log: 'Research log' }
const SECTION_ORDER = ['summary', 'claims', 'sources', 'gaps', 'log']
const SECTION_ALIAS = {
  结论摘要: 'summary', 摘要: 'summary', summary: 'summary', conclusion: 'summary',
  断言: 'claims', 论断: 'claims', claims: 'claims', claim: 'claims',
  证据源: 'sources', 来源: 'sources', 证据: 'sources', sources: 'sources', source: 'sources', evidence: 'sources',
  未决问题: 'gaps', 待解问题: 'gaps', 'open questions': 'gaps', 'open question': 'gaps', gaps: 'gaps',
  检索记录: 'log', 检索日志: 'log', 'research log': 'log', log: 'log',
}
/** H2 标题文本 → 章节键(双语别名表);认不出给 null(未知小节原样保留)。 */
function sectionKeyOf(heading) {
  const s = String(heading == null ? '' : heading).replace(/^#+\s*/, '').trim().replace(/[:：]$/, '')
  if (!s) return null
  const k = SECTION_ALIAS[s]
  if (k) return k
  return SECTION_ALIAS[s.toLowerCase()] || null
}
const headingFor = (key, lang) => (lang === 'en' ? HEAD_EN : HEAD_ZH)[key] || key

const FM_KEYS = {
  dossier_slug: 'slug', dossier_question: 'question', dossier_lang: 'lang', dossier_version: 'version',
  dossier_created: 'created', dossier_updated: 'updated', dossier_rounds: 'rounds',
  dossier_next_claim: 'nextClaim', dossier_next_source: 'nextSource',
}
const FM_ORDER = ['dossier_slug', 'dossier_question', 'dossier_lang', 'dossier_version', 'dossier_created', 'dossier_updated', 'dossier_rounds', 'dossier_next_claim', 'dossier_next_source']
const FM_NUM = new Set(['version', 'rounds', 'nextClaim', 'nextSource'])

const CLAIM_HEAD = /^###\s+(C\d+)\s*(?:[·•・:：\-–—]\s*)?(.*)$/
// 两个分支都必须**整行锚定**:第二支若不锚定(且带 i)就是全行搜索,
// 会把「反方的支持:很弱。」这种用户散文当成元数据行吃掉。第二支还要求值是 ASCII 判据 token。
const CLAIM_META = /^\s*(?:引注|Cites?)\s*[:：]|^\s*(?:支持|Support)\s*[:：]\s*(?:SUPPORTED|NOT_FOUND)\b/i
const SOURCE_HEAD = /^[-*]\s+(S\d+)\s*(?:[·•・]\s*)?(.*)$/
const SUB_QUOTE = /^\s+[-*]\s*(?:引文|Quote)\s*[:：]\s*(.*)$/i
const SUB_CHECK = /^\s+[-*]\s*(?:体检|Check)\s*[:：]\s*(.*)$/i

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
const trimBody = (s) => String(s == null ? '' : s).replace(/^\n+/, '').replace(/\s+$/, '')
/** Amadeus 块标记行是宿主结构数据:解析时不算正文,写回时丢弃(遗留文件的修复)。 */
const stripMarkers = (s) => String(s == null ? '' : s).split('\n').filter((l) => !MARKER_LINE.test(l)).join('\n')

/** 断言末行元数据:逐段容错 —— 缺 支持 段落 NOT_FOUND(保守),缺 引注 段给空数组。 */
function parseClaimMeta(line) {
  const s = String(line == null ? '' : line)
  const out = { cites: [], support: 'NOT_FOUND', hasCites: false }
  const mc = /(?:引注|Cites?)\s*[:：]\s*([^｜|]*)/i.exec(s)
  if (mc) {
    out.hasCites = true
    const ids = mc[1].match(/S\d+/g)
    if (ids) { for (const id of ids) { if (!out.cites.includes(id)) out.cites.push(id) } }
  }
  const ms = /(?:支持|Support)\s*[:：]\s*([A-Za-z_]+)/i.exec(s)
  if (ms && /^SUPPORTED$/i.test(ms[1].trim())) out.support = 'SUPPORTED'
  return out
}
function claimMetaLine(claim, lang) {
  const cites = (claim.cites || []).join(' ')
  return lang === 'en'
    ? `Cites: ${cites} | Support: ${claim.support || 'NOT_FOUND'}`
    : `引注:${cites} ｜ 支持:${claim.support || 'NOT_FOUND'}`
}
function sourceCheckLine(v, lang) {
  if (!v || !v.level) return ''
  const bits = [v.level, v.reason || '', v.at || ''].filter(Boolean)
  return `${lang === 'en' ? 'Check' : '体检'}${lang === 'en' ? ': ' : ':'}${bits.join(' · ')}`
}

/** 磁盘文本 → 模型。未知 frontmatter 键、未知 H2 小节、首个 H2 之前的前言一律原位保留。 */
function parseDossier(text) {
  const raw = String(text == null ? '' : text).replace(/\r\n/g, '\n')
  const model = {
    fm: { slug: '', question: '', lang: 'zh', version: 0, created: '', updated: '', rounds: 0, nextClaim: 1, nextSource: 1 },
    fmLines: [], hadFm: false, preamble: '', sections: [],
    summary: '', claims: [], sources: [], gaps: [], log: [], parseOk: true,
  }
  let bodyText = raw
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(raw)
  if (fmMatch) {
    model.hadFm = true
    bodyText = raw.slice(fmMatch[0].length)
    for (const line of fmMatch[1].split('\n')) {
      const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line)
      if (!kv) { model.fmLines.push({ raw: line }); continue }
      model.fmLines.push({ key: kv[1], value: kv[2] })
      const field = FM_KEYS[kv[1]]
      if (!field) continue
      if (FM_NUM.has(field)) {
        const n = parseInt(kv[2].trim(), 10)
        model.fm[field] = Number.isFinite(n) ? n : model.fm[field]
      } else {
        model.fm[field] = kv[2].trim()
      }
    }
  }
  if (model.fm.lang !== 'en') model.fm.lang = 'zh'
  if (!(model.fm.nextClaim > 0)) model.fm.nextClaim = 1
  if (!(model.fm.nextSource > 0)) model.fm.nextSource = 1

  // 按 H2 切段(围栏内的 ## 不算标题)
  const lines = bodyText.split('\n')
  const chunks = []
  let pre = []
  let cur = null
  let fence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) fence = !fence
    const isH2 = !fence && /^##\s+/.test(line)
    if (isH2) {
      if (cur) chunks.push(cur)
      cur = { heading: line.replace(/\s+$/, ''), lines: [] }
      continue
    }
    if (cur) cur.lines.push(line)
    else pre.push(line)
  }
  if (cur) chunks.push(cur)
  model.preamble = stripMarkers(pre.join('\n')).replace(/\s+$/, '')
  for (const c of chunks) {
    const key = sectionKeyOf(c.heading)
    const body = c.lines.join('\n')
    model.sections.push({ key, heading: c.heading, body })
    if (key === 'summary') model.summary = trimBody(stripMarkers(body))
    else if (key === 'claims') model.claims = parseClaims(body)
    else if (key === 'sources') model.sources = parseSources(body)
    else if (key === 'gaps') model.gaps = parseBullets(body)
    else if (key === 'log') model.log = parseBullets(body)
  }
  // 计数器自愈:文件被手改过时,永不让新号撞已存在的号
  for (const c of model.claims) { const n = parseInt(c.id.slice(1), 10); if (n >= model.fm.nextClaim) model.fm.nextClaim = n + 1 }
  for (const s of model.sources) { const n = parseInt(s.id.slice(1), 10); if (n >= model.fm.nextSource) model.fm.nextSource = n + 1 }
  // 引用到不存在的源:丢弃该引用,其余保留
  const have = new Set(model.sources.map((s) => s.id))
  for (const c of model.claims) c.cites = (c.cites || []).filter((x) => have.has(x))
  return model
}
function parseBullets(body) {
  const out = []
  for (const line of String(body == null ? '' : body).split('\n')) {
    if (MARKER_LINE.test(line)) continue
    const m = /^\s*[-*]\s+(.*)$/.exec(line)
    if (m && m[1].trim()) out.push(m[1].replace(/\s+$/, ''))
  }
  return out
}
function parseClaims(body) {
  const lines = String(body == null ? '' : body).split('\n')
  const out = []
  let cur = null
  let fence = false
  const flush = () => {
    if (!cur) return
    let buf = cur.buf.filter((l) => !MARKER_LINE.test(l))
    let meta = { cites: [], support: 'NOT_FOUND', hasCites: false }
    let last = buf.length - 1
    while (last >= 0 && !buf[last].trim()) last -= 1
    if (last >= 0 && CLAIM_META.test(buf[last])) {
      meta = parseClaimMeta(buf[last])
      buf = buf.slice(0, last)
    }
    out.push({ id: cur.id, title: cur.title, body: trimBody(buf.join('\n')), cites: meta.cites, support: meta.support, hasCites: meta.hasCites })
    cur = null
  }
  for (const line of lines) {
    if (/^\s*```/.test(line)) fence = !fence
    const h = fence ? null : CLAIM_HEAD.exec(line)
    if (h) { flush(); cur = { id: h[1], title: h[2].replace(/\s+$/, ''), buf: [] }; continue }
    if (cur) cur.buf.push(line)
  }
  flush()
  return out
}
function parseSources(body) {
  const lines = String(body == null ? '' : body).split('\n')
  const out = []
  let cur = null
  for (const line of lines) {
    if (MARKER_LINE.test(line)) continue
    const q = SUB_QUOTE.exec(line)
    if (q && cur) { cur.quote = q[1].replace(/^["“”']|["“”']$/g, '').replace(/\s+$/, ''); continue }
    const c = SUB_CHECK.exec(line)
    if (c && cur) {
      const parts = c[1].split('·').map((x) => x.trim()).filter(Boolean)
      const level = parts[0] && VERDICT_KEY[parts[0]] ? parts[0] : ''
      if (level) cur.verdict = { level, reason: parts[1] || '', at: parts[2] || '' }
      continue
    }
    const h = SOURCE_HEAD.exec(line)
    if (!h) continue
    if (cur) out.push(cur)
    let title = h[2].replace(/\s+$/, '')
    let url = ''
    const sp = /^(.*)\s+[—–]\s+(\S+)\s*$/.exec(title)
    if (sp) { title = sp[1].replace(/\s+$/, ''); url = sp[2] }
    else {
      const u = /(https?:\/\/\S+)\s*$/.exec(title)
      if (u) { url = u[1]; title = title.slice(0, u.index).replace(/[\s—–-]+$/, '') }
    }
    cur = { id: h[1], title, url, quote: '', verdict: null }
  }
  if (cur) out.push(cur)
  return out
}

/** 模型 → 磁盘文本。章节标题与标签按 `dossier_lang` 落盘(**与 UI 语言无关**)。 */
function serializeDossier(model) {
  const m = model || {}
  const fm = m.fm || {}
  const lang = fm.lang === 'en' ? 'en' : 'zh'
  const val = {
    dossier_slug: fm.slug || '', dossier_question: fm.question || '', dossier_lang: lang,
    dossier_version: String(fm.version | 0), dossier_created: fm.created || '', dossier_updated: fm.updated || '',
    dossier_rounds: String(fm.rounds | 0), dossier_next_claim: String(fm.nextClaim || 1), dossier_next_source: String(fm.nextSource || 1),
  }
  const emitted = new Set()
  const fmOut = []
  for (const l of m.fmLines || []) {
    if (l.raw != null) { fmOut.push(l.raw); continue }
    if (FM_KEYS[l.key]) { if (emitted.has(l.key)) continue; emitted.add(l.key); fmOut.push(`${l.key}: ${val[l.key]}`); continue }
    fmOut.push(`${l.key}: ${l.value}`)
  }
  for (const k of FM_ORDER) { if (!emitted.has(k)) fmOut.push(`${k}: ${val[k]}`) }
  const parts = ['---', fmOut.join('\n'), '---', '']
  if (m.preamble && m.preamble.trim()) { parts.push(m.preamble.replace(/\s+$/, ''), '') }
  else if (fm.question) { parts.push(`# ${fm.question}`, '') }
  const body = {
    summary: () => [trimBody(m.summary) || ''],
    claims: () => renderClaims(m.claims, lang),
    sources: () => renderSources(m.sources, lang),
    gaps: () => (m.gaps || []).map((g) => `- ${g}`),
    log: () => (m.log || []).map((g) => `- ${g}`),
  }
  const done = new Set()
  const emitSection = (key, heading) => {
    done.add(key)
    parts.push(heading)
    parts.push('')
    const rows = body[key]()
    for (const r of rows) parts.push(r)
    parts.push('')
  }
  for (const s of m.sections || []) {
    // 未知小节:逐字回放(连标题后的空行都不动),文件是用户的
    if (!s.key) { parts.push(s.heading, String(s.body == null ? '' : s.body).replace(/\s+$/, ''), ''); continue }
    if (done.has(s.key)) continue
    emitSection(s.key, s.heading)
  }
  for (const k of SECTION_ORDER) { if (!done.has(k)) emitSection(k, `## ${headingFor(k, lang)}`) }
  // 折叠连续空行,收尾单个换行
  const outLines = []
  for (const p of parts) { for (const line of String(p == null ? '' : p).split('\n')) outLines.push(line) }
  const cleaned = []
  for (const line of outLines) {
    if (!line.trim() && cleaned.length && !cleaned[cleaned.length - 1].trim()) continue
    cleaned.push(line.replace(/\s+$/, ''))
  }
  while (cleaned.length && !cleaned[cleaned.length - 1].trim()) cleaned.pop()
  return cleaned.join('\n') + '\n'
}
function renderClaims(claims, lang) {
  const rows = []
  if (!claims || !claims.length) { rows.push(lang === 'en' ? '_No reliable claim yet._' : '_暂无可靠断言。_'); return rows }
  for (const c of claims) {
    rows.push(`### ${c.id} · ${c.title || ''}`)
    const b = trimBody(c.body)
    if (b) rows.push(b)
    rows.push(claimMetaLine(c, lang))
    rows.push('')
  }
  while (rows.length && !String(rows[rows.length - 1]).trim()) rows.pop()
  return rows
}
function renderSources(sources, lang) {
  const rows = []
  if (!sources || !sources.length) { rows.push(lang === 'en' ? '_No source yet._' : '_暂无证据源。_'); return rows }
  for (const s of sources) {
    rows.push(`- ${s.id} · ${s.title || ''} — ${s.url || ''}`)
    if (s.quote) rows.push(`  - ${lang === 'en' ? 'Quote: ' : '引文:'}"${s.quote}"`)
    const chk = sourceCheckLine(s.verdict, lang)
    if (chk) rows.push(`  - ${chk}`)
  }
  return rows
}

/** 语义内容指纹(**不含判据与时间戳**):相同 → 不 bump 版本、不写历史、不写文件。 */
function bodyDigest(model) {
  const m = model || {}
  const parts = [`S:${collapse(m.summary)}`]
  for (const c of m.claims || []) parts.push(`C:${c.id}|${collapse(c.title)}|${collapse(c.body)}|${(c.cites || []).join(',')}|${c.support || ''}`)
  for (const s of m.sources || []) parts.push(`R:${s.id}|${collapse(s.title)}|${normalizeUrl(s.url) || collapse(s.url)}|${collapse(s.quote)}`)
  for (const g of m.gaps || []) parts.push(`G:${collapse(g)}`)
  return parts.join('\n')
}
function healthSummary(model) {
  const out = { live: 0, dead: 0, suspect: 0, unknown: 0 }
  for (const s of (model && model.sources) || []) {
    const lv = s.verdict && s.verdict.level
    if (lv === 'LIVE') out.live += 1
    else if (lv === 'DEAD') out.dead += 1
    else if (lv === 'LIKELY_HALLUCINATED') out.suspect += 1
    else out.unknown += 1
  }
  return out
}
/** prev/cur 都是 parseDossier 的产物(快照 vs 当前文件),同一条解析器。 */
function diffVersions(prev, cur) {
  const pc = new Map((((prev || {}).claims) || []).map((c) => [c.id, c]))
  const cc = (((cur || {}).claims) || [])
  const claimsAdded = []
  const claimsChanged = []
  const claimsRemoved = []
  const seen = new Set()
  for (const c of cc) {
    seen.add(c.id)
    const p = pc.get(c.id)
    if (!p) { claimsAdded.push(c.id); continue }
    if (collapse(p.title) !== collapse(c.title) || collapse(p.body) !== collapse(c.body)) claimsChanged.push(c.id)
  }
  for (const id of pc.keys()) { if (!seen.has(id)) claimsRemoved.push(id) }
  const pu = new Set((((prev || {}).sources) || []).map((s) => normalizeUrl(s.url) || collapse(s.url)))
  const sourcesAdded = (((cur || {}).sources) || []).filter((s) => !pu.has(normalizeUrl(s.url) || collapse(s.url))).map((s) => s.id)
  const cg = new Set((((cur || {}).gaps) || []).map(collapse))
  const gapsClosed = (((prev || {}).gaps) || []).filter((g) => !cg.has(collapse(g)))
  return { claimsAdded, claimsChanged, claimsRemoved, sourcesAdded, gapsClosed }
}

/** 模型给的 prev 命中既有集合才复用;不存在 / 重复引用 → 新号。计数器只增,删过的号永不复用。 */
function reconcileClaimIds(existingIds, incoming, nextClaim) {
  const have = new Set(existingIds || [])
  const used = new Set()
  let n = Math.max(1, nextClaim | 0)
  const claims = []
  for (const c of incoming || []) {
    const prev = c && c.prev && have.has(c.prev) && !used.has(c.prev) ? c.prev : null
    let id
    if (prev) { id = prev; used.add(prev) }
    else { id = `C${n}`; n += 1 }
    claims.push({
      id,
      title: String((c && c.title) || '').replace(/\s+/g, ' ').trim(),
      body: trimBody((c && c.body) || ''),
      support: String((c && c.support) || '').toLowerCase() === 'supported' ? 'SUPPORTED' : 'NOT_FOUND',
      rawCites: Array.isArray(c && c.cites) ? c.cites.map((x) => String(x)) : [],
      cites: [],
    })
  }
  return { claims, nextClaim: n }
}
/**
 * 既有源 + 本轮新源 → 稳定 Sn。同 URL(归一后)复用既有号并**保留既有判据**;
 * 超 max 按被引用次数截断(未被引用的先掉)。opts.cites = 每条断言的引用键数组(模型 key 或 Sn)。
 */
function mergeSources(existing, incoming, nextSource, opts) {
  const o = opts || {}
  const max = Number.isFinite(o.max) ? Math.max(1, o.max | 0) : 0
  let n = Math.max(1, nextSource | 0)
  const sources = (existing || []).map((s) => ({ id: s.id, title: s.title || '', url: s.url || '', quote: s.quote || '', verdict: s.verdict || null }))
  const byUrl = new Map()
  for (const s of sources) { const k = normalizeUrl(s.url); if (k) byUrl.set(k, s) }
  const keyMap = {}
  for (const inc of incoming || []) {
    if (!inc) continue
    const url = String(inc.url == null ? '' : inc.url).trim()
    const k = normalizeUrl(url)
    if (!k || !safeHref(url)) continue // javascript:/file:/空串 一律不进源表
    const hit = byUrl.get(k)
    if (hit) {
      if (!hit.title && inc.title) hit.title = String(inc.title)
      if (!hit.quote && inc.quote) hit.quote = String(inc.quote)
      if (inc.key) keyMap[String(inc.key)] = hit.id
      continue
    }
    const s = { id: `S${n}`, title: String(inc.title || ''), url, quote: String(inc.quote || ''), verdict: null }
    n += 1
    sources.push(s)
    byUrl.set(k, s)
    if (inc.key) keyMap[String(inc.key)] = s.id
  }
  // 引用计数(翻译后)
  const counts = {}
  for (const arr of o.cites || []) {
    for (const raw of arr || []) {
      const id = keyMap[String(raw)] || (/^S\d+$/.test(String(raw)) ? String(raw) : '')
      if (id) counts[id] = (counts[id] || 0) + 1
    }
  }
  let out = sources
  if (max && sources.length > max) {
    const ranked = sources.slice().sort((a, b) => {
      const d = (counts[b.id] || 0) - (counts[a.id] || 0)
      if (d) return d
      return parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10)
    })
    const keep = new Set(ranked.slice(0, max).map((s) => s.id))
    out = sources.filter((s) => keep.has(s.id))
  }
  return { sources: out, nextSource: n, keyMap, counts }
}

// ── slug ─────────────────────────────────────────────────────────────────────
function slugifyTopic(q) {
  const s = String(q == null ? '' : q).toLowerCase().trim()
  const cleaned = s.replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-+|-+$/g, '')
  return (cleaned ? cleaned.slice(0, 48).replace(/-+$/, '') : '') || 'dossier'
}
function uniqueSlug(base, taken) {
  const set = taken instanceof Set ? taken : new Set(taken || [])
  const b = base || 'dossier'
  if (!set.has(b)) return b
  for (let i = 2; i < 999; i++) { const c = `${b}-${i}`; if (!set.has(c)) return c }
  return `${b}-${Date.now()}`
}

/** Agent 的 ```dossier fence → 结构化数据。围栏里可能嵌代码,先贪婪再回退惰性。 */
function parseAgentOutput(out) {
  const s = String(out == null ? '' : out)
  const tries = []
  const greedy = /```(?:dossier|json\s+dossier)\s*\n([\s\S]*)```/i.exec(s)
  if (greedy) tries.push(greedy[1])
  const lazy = /```(?:dossier|json\s+dossier)\s*\n([\s\S]*?)```/i.exec(s)
  if (lazy) tries.push(lazy[1])
  const i = s.indexOf('{')
  const j = s.lastIndexOf('}')
  if (i >= 0 && j > i) tries.push(s.slice(i, j + 1))
  for (const body of tries) {
    let d
    try { d = JSON.parse(body) } catch { continue }
    if (!d || typeof d !== 'object') continue
    return {
      ok: true,
      data: {
        summary: String(d.summary == null ? '' : d.summary),
        claims: Array.isArray(d.claims) ? d.claims : [],
        // 显式作废清单:只认 `Cn` 形态。没进 claims 也没进 drop 的既有断言一律**保留**
        // ——「模型没重报 = 删除」是不可逆的数据丢失,不能靠模型记得重抄一遍来避免。
        drop: Array.isArray(d.drop) ? d.drop.map((x) => String(x == null ? '' : x).trim().toUpperCase()).filter((x) => /^C\d+$/.test(x)) : [],
        sources: Array.isArray(d.sources) ? d.sources : [],
        // 显式 [] = 「这一轮全解决了」(会让上一版的未决问题进 diff 的 gapsClosed);
        // 键整个缺席 = 模型没说 → null,保留既有未决问题,不当成解决了。
        gaps: Array.isArray(d.gaps) ? d.gaps.map((x) => collapse(x)).filter(Boolean) : null,
        log: Array.isArray(d.log) ? d.log : [],
      },
    }
  }
  return { ok: false, data: null }
}

// ── XSS 安全 Markdown 渲染(只 createElement + textContent) ──────────────────
function inline(text) {
  const frag = document.createDocumentFragment()
  let rest = String(text == null ? '' : text)
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_|(https?:\/\/[^\s<>"'`)\]]+)/
  let m
  let guard = 0
  while ((m = re.exec(rest)) && guard++ < 4000) {
    if (m.index > 0) frag.appendChild(document.createTextNode(rest.slice(0, m.index)))
    if (m[1] != null) { const b = document.createElement('strong'); b.textContent = m[1]; frag.appendChild(b) }
    else if (m[2] != null) { const c = document.createElement('code'); c.textContent = m[2]; frag.appendChild(c) }
    else if (m[3] != null) {
      const a = document.createElement('a')
      a.textContent = m[3]
      const href = safeHref(m[4])
      if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
      frag.appendChild(a)
    } else if (m[5] != null) { const e = document.createElement('em'); e.textContent = m[5]; frag.appendChild(e) }
    else if (m[6] != null) { const e = document.createElement('em'); e.textContent = m[6]; frag.appendChild(e) }
    else if (m[7] != null) {
      const a = document.createElement('a')
      a.textContent = m[7]
      const href = safeHref(m[7])
      if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
      frag.appendChild(a)
    }
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) frag.appendChild(document.createTextNode(rest))
  return frag
}
function renderMarkdown(container, md) {
  container.textContent = ''
  const lines = String(md == null ? '' : md).replace(/\r\n/g, '\n').split('\n')
  let i = 0
  let para = []
  let list = null
  let listTag = null
  const flushPara = () => { if (para.length) { const p = document.createElement('p'); p.appendChild(inline(para.join(' '))); container.appendChild(p); para = [] } }
  const flushList = () => { if (list) { container.appendChild(list); list = null; listTag = null } }
  while (i < lines.length) {
    const t0 = lines[i].replace(/\s+$/, '').trim()
    if (/^```/.test(t0)) {
      flushPara(); flushList()
      const buf = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i += 1 }
      i += 1
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      code.textContent = buf.join('\n')
      pre.appendChild(code)
      container.appendChild(pre)
      continue
    }
    if (t0 === '') { flushPara(); flushList(); i += 1; continue }
    if (MARKER_LINE.test(t0)) { i += 1; continue }
    const hd = /^(#{1,6})\s+(.*)$/.exec(t0)
    if (hd) {
      flushPara(); flushList()
      const el = document.createElement('h' + Math.min(4, hd[1].length))
      el.appendChild(inline(hd[2]))
      container.appendChild(el)
      i += 1
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t0)) { flushPara(); flushList(); container.appendChild(document.createElement('hr')); i += 1; continue }
    if (/^>\s?/.test(t0)) {
      flushPara(); flushList()
      const bq = document.createElement('blockquote')
      bq.appendChild(inline(t0.replace(/^>\s?/, '')))
      container.appendChild(bq)
      i += 1
      continue
    }
    const ul = /^[-*]\s+(.*)$/.exec(t0)
    const ol = /^\d+\.\s+(.*)$/.exec(t0)
    if (ul || ol) {
      flushPara()
      const want = ul ? 'ul' : 'ol'
      if (list && listTag !== want) flushList()
      if (!list) { list = document.createElement(want); listTag = want }
      const li = document.createElement('li')
      li.appendChild(inline(ul ? ul[1] : ol[1]))
      list.appendChild(li)
      i += 1
      continue
    }
    flushList()
    para.push(t0)
    i += 1
  }
  flushPara()
  flushList()
}

// ── 主题:吃宿主 token,一切文字色经 readableOn 保底(真机对比度门禁两档都量) ──
let _probe = null
function parseColor(css) {
  try {
    const s = String(css == null ? '' : css).trim()
    if (!s || !globalThis.document) return null
    if (!_probe) {
      const c = document.createElement('canvas')
      if (typeof c.getContext !== 'function') return null
      c.width = 1
      c.height = 1
      _probe = c.getContext('2d', { willReadFrequently: true })
    }
    if (!_probe) return null
    _probe.fillStyle = '#000000'
    _probe.fillStyle = s
    const a = _probe.fillStyle
    _probe.fillStyle = '#ffffff'
    _probe.fillStyle = s
    if (a === '#000000' && _probe.fillStyle === '#ffffff') return null
    _probe.clearRect(0, 0, 1, 1)
    _probe.fillRect(0, 0, 1, 1)
    const d = _probe.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  } catch { return null }
}
const relL = (c) => {
  const g = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2])
}
const contrast = (a, b) => { const x = relL(a); const y = relL(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const onColorOf = (accent) => (contrast(accent, [255, 255, 255]) >= contrast(accent, [22, 22, 26]) ? '#ffffff' : '#16161a')
/** fg 朝 text 掺开直到与 bg 的对比度达标(强调色/语义色在深浅两档都要读得清)。 */
function readableOn(fg, bg, text, min) {
  const target = Number.isFinite(min) ? min : 3
  let c = [fg[0], fg[1], fg[2]]
  for (let i = 0; i < 20 && contrast(c, bg) < target; i++) c = c.map((v, k) => v + (text[k] - v) * 0.16)
  return `rgb(${c.map((v) => Math.round(v)).join(',')})`
}
const composite = (fg, bg) => {
  if (!fg) return bg
  const a = fg[3] == null ? 1 : fg[3]
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)]
}
function syncTheme(rootEl) {
  if (typeof getComputedStyle === 'undefined') return
  let cs
  try { cs = getComputedStyle(rootEl) } catch { return }
  const tok = (n) => String((cs.getPropertyValue && cs.getPropertyValue(n)) || '').trim()
  const rgb = parseColor(tok('--text')) || parseColor(cs.color) || [40, 40, 40, 1]
  const dark = relL(rgb) > 0.5
  const bgc = parseColor(tok('--bg')) || (dark ? [23, 24, 28, 1] : [255, 255, 255, 1])
  const bg = [bgc[0], bgc[1], bgc[2]]
  const txt = [rgb[0], rgb[1], rgb[2]]
  const surf = composite(parseColor(tok('--bg-card')), bg)
  const rd = Math.round
  const f = (a) => `rgba(${rd(txt[0])},${rd(txt[1])},${rd(txt[2])},${a})`
  const accent = tok('--accent') || (dark ? '#cfc9ff' : '#4C2585')
  const arc = parseColor(accent) || [76, 37, 133, 1]
  const af = (a) => `rgba(${rd(arc[0])},${rd(arc[1])},${rd(arc[2])},${a})`
  const set = (k, v) => rootEl.style.setProperty(`--ds-${k}`, v)
  rootEl.style.colorScheme = dark ? 'dark' : 'light'
  set('bg', tok('--bg') || `rgb(${rd(bg[0])},${rd(bg[1])},${rd(bg[2])})`)
  set('surf', tok('--bg-card') || f(0.05))
  set('surf-sub', f(0.03))
  set('input', f(0.05))
  set('hover', f(0.08))
  set('border', tok('--border') || f(0.16))
  set('border-sub', f(0.1))
  // 文字色:一律 readableOn 兜底 —— 原生 token 在某些皮肤下低到 1.8:1(真机门禁 2.5 就红)
  set('text', tok('--text') || `rgb(${rd(txt[0])},${rd(txt[1])},${rd(txt[2])})`)
  set('text-sec', readableOn(composite(parseColor(tok('--text-light')), surf) || txt, surf, txt, 5.5))
  set('text-muted', readableOn(composite(parseColor(tok('--text-muted')), surf) || txt, surf, txt, 4.6))
  set('fill', accent)
  set('on-fill', tok('--on-accent') || onColorOf(arc))
  set('primary', readableOn(arc, surf, txt, 4.5))
  set('tint', tok('--accent-light') || af(0.14))
  set('glow', af(0.22))
  const green = parseColor(tok('--green')) || (dark ? [143, 178, 149, 1] : [79, 111, 82, 1])
  const danger = parseColor(tok('--danger')) || (dark ? [217, 144, 128, 1] : [163, 80, 63, 1])
  const amber = dark ? [222, 176, 92, 1] : [176, 116, 20, 1]
  set('live', readableOn(green, surf, txt, 4.6))
  set('dead', readableOn(danger, surf, txt, 4.6))
  set('suspect', readableOn(amber, surf, txt, 4.6))
  set('unknown', readableOn(composite(parseColor(tok('--text-muted')), surf) || txt, surf, txt, 4.6))
  set('shadow', tok('--card-shadow') || (dark ? '0 4px 20px rgba(0,0,0,.4)' : '0 2px 12px rgba(0,0,0,.08)'))
}
function themeObserver(rootEl) {
  syncTheme(rootEl)
  let disc = () => {}
  if (typeof MutationObserver !== 'undefined') {
    const ob = new MutationObserver(() => syncTheme(rootEl))
    try {
      for (let n = rootEl.parentElement; n; n = n.parentElement) ob.observe(n, { attributes: true, attributeFilter: ['class', 'data-mode', 'data-theme', 'data-skin', 'style'] })
      if (globalThis.document && document.documentElement) ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-mode', 'data-theme', 'data-skin', 'style'] })
    } catch { /* ignore */ }
    disc = () => ob.disconnect()
  }
  const mq = globalThis.window && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const onMq = () => syncTheme(rootEl)
  if (mq && mq.addEventListener) mq.addEventListener('change', onMq)
  return () => { disc(); if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq) }
}

const STYLE = `
.ds-root{height:100%;min-height:0;overflow:auto;color:inherit;background:var(--ds-bg);font-size:13px;line-height:1.6}
.ds-root *{box-sizing:border-box}
.ds-root ::-webkit-scrollbar{width:6px;height:6px}.ds-root ::-webkit-scrollbar-thumb{background:var(--ds-border);border-radius:3px}
.ds-wrap{max-width:820px;margin:0 auto;padding:18px 20px 48px;display:flex;flex-direction:column;gap:12px}
.ds-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.ds-title{font-size:20px;font-weight:700;color:var(--ds-text)}
.ds-sub{font-size:12px;color:var(--ds-text-muted)}
.ds-flex1{flex:1}
.ds-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ds-btn{padding:6px 12px;font:inherit;font-size:12px;color:var(--ds-text-sec);border:1px solid var(--ds-border);border-radius:var(--radius-sm);background:var(--ds-surf);cursor:pointer;transition:background .18s,border-color .18s,color .18s;white-space:nowrap}
.ds-btn:hover:not(:disabled){background:var(--ds-tint);border-color:var(--ds-primary);color:var(--ds-primary)}
.ds-btn:disabled{opacity:.55;cursor:default}
.ds-btn.primary{color:var(--ds-on-fill);background:var(--ds-fill);border-color:transparent;font-weight:500}
.ds-btn.primary:hover:not(:disabled){color:var(--ds-on-fill);background:var(--ds-fill);filter:brightness(1.06)}
.ds-btn.sm{padding:4px 9px;font-size:11.5px;border-radius:var(--radius-sm)}
.ds-card{border-radius:var(--radius-md);background:var(--ds-surf);border:1px solid var(--ds-border);box-shadow:var(--ds-shadow);padding:12px;display:flex;flex-direction:column;gap:8px}
.ds-ta{width:100%;min-height:62px;max-height:220px;resize:none;padding:9px 12px;font:inherit;color:var(--ds-text);background:var(--ds-input);border:1.5px solid var(--ds-border);border-radius:var(--radius-sm);outline:none}
.ds-ta::placeholder{color:var(--ds-text-muted)}
.ds-ta:focus{border-color:var(--ds-primary);box-shadow:0 0 0 3px var(--ds-glow)}
.ds-src{width:100%;min-height:320px;resize:vertical;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--ds-text);background:var(--ds-input);border:1.5px solid var(--ds-border);border-radius:var(--radius-sm);outline:none}
.ds-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-text-muted)}
.ds-item{border:1px solid var(--ds-border-sub);border-radius:var(--radius-md);padding:10px 12px;background:var(--ds-surf);display:flex;flex-direction:column;gap:6px}
.ds-item:hover{border-color:var(--ds-primary)}
.ds-q{font-size:13.5px;font-weight:600;color:var(--ds-text);word-break:break-word}
.ds-meta{font-size:11.5px;color:var(--ds-text-muted);display:flex;gap:10px;flex-wrap:wrap}
.ds-chip{padding:1px 8px;border-radius:var(--radius-pill, 999px);background:var(--ds-tint);color:var(--ds-primary);font-size:11px;white-space:nowrap}
.ds-badge{padding:1px 8px;border-radius:var(--radius-pill, 999px);font-size:11px;white-space:nowrap;border:1px solid currentColor}
.ds-badge.live{color:var(--ds-live)}
.ds-badge.dead{color:var(--ds-dead)}
.ds-badge.suspect{color:var(--ds-suspect)}
.ds-badge.unknown{color:var(--ds-unknown)}
.ds-empty{padding:40px 12px;text-align:center;color:var(--ds-text-muted);font-size:12.5px}
.ds-empty b{display:block;font-size:15px;color:var(--ds-text-sec);margin-bottom:8px}
.ds-steps{display:flex;gap:4px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--ds-text-muted)}
.ds-step{padding:2px 9px;border-radius:var(--radius-pill, 999px);border:1px solid var(--ds-border-sub)}
.ds-step.on{background:var(--ds-tint);color:var(--ds-primary);border-color:transparent}
.ds-track{height:4px;border-radius:var(--radius-pill, 999px);background:var(--ds-border-sub);overflow:hidden}
.ds-fill{height:100%;width:0;border-radius:var(--radius-pill, 999px);background:var(--ds-primary);transition:width .45s ease-out}
.ds-stream{max-height:260px;overflow:auto;font-size:12.5px;color:var(--ds-text-sec);word-break:break-word}
.ds-stream h1,.ds-stream h2,.ds-stream h3,.ds-stream h4{font-size:13.5px;margin:10px 0 4px;color:var(--ds-text)}
.ds-stream p{margin:6px 0}
.ds-stream pre{background:var(--ds-input);border-radius:var(--radius-sm);padding:8px;overflow:auto;font-size:11.5px}
.ds-stream a{color:var(--ds-primary);word-break:break-all}
.ds-stream code{background:var(--ds-input);border-radius:var(--radius-xs, 4px);padding:0 4px}
.ds-doc{font-size:13px;color:var(--ds-text-sec);word-break:break-word}
.ds-doc h1{font-size:19px;margin:4px 0 10px;color:var(--ds-text)}
.ds-doc h2{font-size:15px;margin:16px 0 6px;color:var(--ds-text)}
.ds-doc h3{font-size:13.5px;margin:12px 0 4px;color:var(--ds-text)}
.ds-doc a{color:var(--ds-primary);word-break:break-all}
.ds-doc pre{background:var(--ds-input);border-radius:var(--radius-sm);padding:8px;overflow:auto;font-size:11.5px}
.ds-doc code{background:var(--ds-input);border-radius:var(--radius-xs, 4px);padding:0 4px}
.ds-doc blockquote{border-left:2px solid var(--ds-border);margin:6px 0;padding-left:10px;color:var(--ds-text-muted)}
.ds-probe{display:flex;flex-direction:column;gap:5px;max-height:300px;overflow:auto}
.ds-prow{display:flex;gap:8px;align-items:baseline;font-size:11.5px;flex-wrap:wrap}
.ds-purl{color:var(--ds-text-sec);word-break:break-all;flex:1;min-width:120px}
.ds-why{color:var(--ds-text-muted);font-size:11px}
.ds-err{color:var(--ds-dead);font-size:12px;word-break:break-word}
.ds-hint{font-size:11.5px;color:var(--ds-text-muted)}
`

// ── UI 小工具 ────────────────────────────────────────────────────────────────
function h(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}
function mkBtn(label, cls, onClick) {
  const b = h('button', `ds-btn${cls ? ' ' + cls : ''}`, label)
  if (onClick) b.addEventListener('click', onClick)
  return b
}

// ── 跨视图小总线 + 语言重渲注册表 ────────────────────────────────────────────
const bus = (() => {
  const subs = new Set()
  return { on: (f) => { subs.add(f); return () => subs.delete(f) }, emit: (e) => { subs.forEach((f) => { try { f(e) } catch { /* ignore */ } }) } }
})()
const rerenders = new Set()
const rerenderAll = () => { rerenders.forEach((f) => { try { f() } catch { /* ignore */ } }) }
const offLocale = ctx.subscribeLocale ? ctx.subscribeLocale(() => rerenderAll()) : null

// ── 串行写队列(并发的续研 / 体检 / 源码保存互斥排队) ─────────────────────────
let writeChain = Promise.resolve()
function enqueueWrite(job) {
  const p = writeChain.then(job)
  writeChain = p.then(() => {}, () => {})
  return p
}

// ── 课题索引(派生,只管发现) ─────────────────────────────────────────────────
const emptyIndex = () => ({ v: 1, items: [] })
/** 读索引:readFile 抛错原样上抛(调用方中止本次操作);JSON 坏 → 备份 .bak 后重置。 */
async function readIndex() {
  let text
  try { text = await ctx.app.readFile(indexPath()) }
  catch (e) { const err = new Error(String((e && e.message) || e)); err.ioFail = true; throw err }
  if (!text) return emptyIndex()
  let j
  try { j = JSON.parse(text) } catch { j = null }
  if (!j || !Array.isArray(j.items)) {
    try { await ctx.app.writeFile(`${indexPath()}.bak`, text) } catch { /* ignore */ }
    say(t('index_reset'), { level: 'warning' })
    return emptyIndex()
  }
  return { v: 1, items: j.items.filter((x) => x && x.slug) }
}
const writeIndex = (idx) => ctx.app.writeFile(indexPath(), JSON.stringify(idx, null, 2))
function indexEntryOf(model, path) {
  const fm = (model && model.fm) || {}
  return {
    slug: fm.slug || '',
    path: path || dossierPath(fm.slug || ''),
    question: fm.question || '',
    lang: fm.lang || 'zh',
    version: fm.version | 0,
    updated: fm.updated || '',
    claims: ((model && model.claims) || []).length,
    sources: ((model && model.sources) || []).length,
    health: healthSummary(model),
  }
}
async function upsertIndex(model, path) {
  const idx = await readIndex()
  const entry = indexEntryOf(model, path)
  idx.items = [entry].concat(idx.items.filter((x) => x.slug !== entry.slug))
  await writeIndex(idx)
  return idx
}

// ── 档案读写 ─────────────────────────────────────────────────────────────────
/** path 缺省 = 工作文件夹里的标准位置(斜杠 / 右键建在笔记附件夹里的档案带自己的 path)。 */
async function readDossier(slug, path) {
  let text
  try { text = await ctx.app.readFile(path || dossierPath(slug)) }
  catch (e) { const err = new Error(String((e && e.message) || e)); err.ioFail = true; throw err }
  if (text == null) return null
  return parseDossier(text)
}
function newModel(question, lang) {
  const now = new Date(Date.now()).toISOString()
  const slug = slugifyTopic(question)
  return {
    fm: { slug, question: collapse(question), lang: lang === 'en' ? 'en' : 'zh', version: 0, created: now, updated: now, rounds: 0, nextClaim: 1, nextSource: 1 },
    fmLines: [], hadFm: true, preamble: '', sections: [],
    summary: '', claims: [], sources: [], gaps: [], log: [], parseOk: true,
  }
}
/** 写序:① .history 快照(旧版) → ② .dossier.md → ③ 索引。②③ 之间崩 = 索引落后一版,下次打开自愈。 */
async function persistModel(model, opts) {
  const o = opts || {}
  const slug = model.fm.slug
  const path = o.path || dossierPath(slug)
  if (o.snapshotText && model.fm.version > 0) {
    try { await ctx.app.writeFile(`${historyDir(slug)}/${padVersion(model.fm.version)}.dossier.md`, o.snapshotText) } catch { /* 快照失败不阻断正文落盘 */ }
  }
  if (o.bump) model.fm.version = (model.fm.version | 0) + 1
  model.fm.updated = new Date(Date.now()).toISOString()
  const text = serializeDossier(model)
  await ctx.app.writeFile(path, text)
  await upsertIndex(model, path)
  return text
}

// ── 引擎配置 + 驱动 run(bluebird 配方;需要工具才 execMode:host) ─────────────
async function getCfg() {
  try {
    const c = await (globalThis.window && window.tangu && window.tangu.getConfig ? window.tangu.getConfig() : null)
    if (c && c.backendUrl) return { backendUrl: c.backendUrl, token: c.token || '', modelId: c.modelId || '', cwd: c.defaultWorkspaceDir || c.homeDir || '' }
  } catch { /* web 回退 */ }
  try { return { backendUrl: location.origin + '/api', token: localStorage.getItem('forsion_token') || '', modelId: '', cwd: '' } } catch { /* ignore */ }
  return { backendUrl: '', token: '', modelId: '', cwd: '' }
}
/** 步骤路标(按已到百分比点亮);label 在渲染时才取语言,注册时不冻结。 */
const STEPS = [['step_submit', 6], ['step_search', 20], ['step_draft', 62], ['step_check', 88], ['step_save', 96]]
function stageOf(ev, content) {
  const p = (ev && ev.payload) || {}
  if (!ev) return null
  if (ev.type === 'status') return p.state === 'queued' ? { pct: 10, key: 'st_queued' } : p.state === 'running' ? { pct: 16, key: 'st_running' } : null
  if (ev.type === 'tool_call') return { pct: 34, key: 'st_searching' }
  if (ev.type === 'tool_result') return { pct: 52, key: 'st_reading' }
  if (ev.type === 'token') return { pct: Math.min(86, 60 + String(content || '').length / 160), key: 'st_drafting' }
  return null
}
async function runAgent(cfg, sessionId, message, onTick, signal, opts) {
  const o = opts || {}
  const stage = (pct, key) => { if (o.onStage) o.onStage(pct, key) }
  stage(6, 'st_running')
  const hd = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }
  const payload = { session_id: sessionId, model_id: cfg.modelId || undefined, app_id: APP_ID, message, attachments: [] }
  if (o.host) payload.agent_config = { execMode: 'host', cwd: cfg.cwd || undefined }
  const start = await fetch(`${cfg.backendUrl}/agent/runs`, { method: 'POST', headers: hd, signal, body: JSON.stringify(payload) })
  if (!start.ok) throw new Error((await start.text().catch(() => '')) || `HTTP ${start.status}`)
  const started = await start.json()
  const runId = started && started.runId
  if (!runId) throw new Error('no runId')
  const res = await fetch(`${cfg.backendUrl}/agent/runs/${encodeURIComponent(runId)}/events?fromSeq=0`, { headers: hd, signal })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let lastSeq = 0
  let content = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    buf += dec.decode(chunk.value, { stream: true })
    const parts = buf.split('\n')
    buf = parts.pop() || ''
    for (const line of parts) {
      const s = line.trim()
      if (!s || s.startsWith(':') || !s.startsWith('data:')) continue
      const data = s.slice(5).replace(/^ /, '')
      if (!data) continue
      let ev
      try { ev = JSON.parse(data) } catch { continue }
      if (typeof ev.seq === 'number') { if (ev.seq <= lastSeq) continue; lastSeq = ev.seq }
      if (ev.type === 'token') { const d = ev.payload && ev.payload.delta; if (d) { content += d; if (onTick) onTick(content) } }
      const st = stageOf(ev, content)
      if (st) stage(st.pct, st.key)
      if (ev.type === 'token') continue
      if (ev.type === 'done') { stage(96, 'st_done'); return (ev.payload && ev.payload.content) || content }
      if (ev.type === 'error') throw new Error((ev.payload && ev.payload.error) || 'agent error')
    }
  }
  throw new Error('stream ended without a done event')
}

// ── 发给模型的指令段(一律英文;输出语言由 dossier_lang 显式指定) ─────────────
function buildResearchMessage(model, rounds, maxSources) {
  const fm = model.fm
  const respond = fm.lang === 'en' ? 'Respond in English.' : 'Respond in Chinese.'
  const known = []
  if (model.claims.length) {
    known.push('EXISTING CLAIMS — these stay in the dossier. Do NOT re-send one just to keep it:')
    for (const c of model.claims) known.push(`${c.id}: ${collapse(c.title)}`)
    known.push('To rewrite one, send it in "claims" with "prev" set to its id. To delete an obsolete one, put its id in "drop". Anything you leave out is kept unchanged.')
  }
  if (model.sources.length) {
    known.push('EXISTING SOURCES (already on file; do not re-list them unless you used them again):')
    for (const s of model.sources) known.push(`${s.id}: ${collapse(s.title)} <${s.url}>`)
  }
  if (model.gaps.length) {
    known.push('OPEN QUESTIONS FROM THE LAST ROUND (attack these first):')
    for (const g of model.gaps) known.push(`- ${g}`)
  }
  return `You are building a research dossier for one question in a personal knowledge base. This is round ${(fm.rounds | 0) + 1}.

QUESTION:
${fm.question}

BUDGET: at most ${rounds} rounds of searching in this run. The dossier keeps at most ${maxSources} sources in total.

${known.join('\n')}

RULES — every one of these is enforced by the plugin:
- "claims" is a DELTA, not the whole dossier. Send only what is new or rewritten. Every existing claim you do not mention survives untouched; the only way to remove one is to list its id in "drop".
- Use your web search / web fetch tools to find real, primary sources and read them. Never invent a URL, a title, or a quotation.
- Every claim MUST carry at least one citation key from the "sources" array you output. A claim you cannot cite must not be written at all.
- "support" is "supported" ONLY when a source you actually read states it. Otherwise use "not_found". Never assert that something is false.
- Quote the exact sentence you are relying on in the source's "quote" field, verbatim and in its original language.
- Do NOT create, write or modify any file. Do NOT run shell commands beyond what your search tools require.
- Sources are keyed locally as k1, k2, … inside THIS response only. Never emit S-numbers; the plugin assigns stable ids by URL.
- "gaps" lists what you still could not settle. Be honest; an empty gaps list on a hard question is a red flag.
- ${respond} Keep source titles and quotations in their original language.

OUTPUT: exactly one fenced block whose info string is "dossier", containing only JSON, with nothing before or after it.

\`\`\`dossier
{"summary":"two or three sentences answering the question as far as the evidence goes","claims":[{"ref":"c1","prev":null,"title":"one sentence","body":"the reasoning, may be several lines","support":"supported","cites":["k1"]}],"drop":[],"sources":[{"key":"k1","title":"page title","url":"https://example.org/paper","quote":"the exact sentence you relied on","published":"2026-05-07"}],"gaps":["what is still unsettled"],"log":[{"round":1,"queries":["query you ran"]}]}
\`\`\``
}
function buildProbeMessage(urls) {
  const list = (urls || []).map((u, i) => `${i + 1}. ${u}`).join('\n')
  return `Task: probe a fixed list of URLs for reachability, and report the RAW observations. Nothing else.

Allowed tool: run_bash ONLY. Do not search the web. Do not read or write any file. Do not visit any URL other than the ones listed below.

For EACH url, in order:
1. curl -sIL --max-time 12 -o /dev/null -w '%{http_code} %{url_effective}' '<url>' ; echo " exit=$?"
2. If that status is not 2xx, retry once with: curl -sSL --max-time 12 -r 0-0 -o /dev/null -w '%{http_code} %{url_effective}' '<url>' ; echo " exit=$?"  (use the status from this second attempt)
3. curl -s --max-time 12 'https://archive.org/wayback/available?url=<the url, percent-encoded>'
   - "found"  → the JSON contains an archived snapshot with a timestamp
   - "none"   → the response is valid JSON and contains no snapshot
   - "error"  → the request failed, timed out, or the body is not valid JSON

Report facts only. Do NOT classify, judge, rate or add any field beyond the schema below — the plugin decides the verdict, not you. If you cannot probe a url, still emit its row with exit set to the curl exit code.

Output exactly one fenced block with info string "json", containing only this JSON:

\`\`\`json
{"probes":[{"url":"<the url exactly as given>","http":200,"final":"https://…","exit":0,"wayback":"found","waybackTs":"20240102030405"}]}
\`\`\`

URLS:
${list}`
}

// ── 运行态(模块级:关掉视图 run 照跑) ────────────────────────────────────────
// 错误也要跟着语言走:插件自己产生的错一律存**词表键**(errorKey/probeErrorKey),
// 只有引擎/异常给的原始串才存文本(它本来就没有译文)。render 时才取语言 —— 切语言当场变。
const run = {
  mode: '', slug: '', path: '', question: '', running: false, pct: 0, stageKey: '', stream: '',
  error: '', errorKey: '', errorVars: null, rawOutput: '', rawPath: '', controller: null, diff: null, diffFrom: 0,
  probes: [], probeRunning: false, probeAt: 0, probeError: '', probeErrorKey: '', probeScope: '', noteName: '',
  // 体检 / 找回档案也各自持一个 controller:它们同样是在飞的 SSE 流,跑完还会 writeFile 进用户库。
  // 只 abort run.controller 的话,插件禁用/重载后这两条流会继续读、继续写盘。
  probeController: null, recoverController: null,
}
/** 带词表键的错误:抛出去时是当时语言的可读串,接住后按键重渲。 */
function mkErr(key, vars) {
  const e = new Error(t(key, vars))
  e.msgKey = key
  e.msgVars = vars || null
  return e
}
const errText = () => (run.errorKey ? t(run.errorKey, run.errorVars || undefined) : run.error)
const probeErrText = () => (run.probeErrorKey ? t(run.probeErrorKey) : run.probeError)
const emit = () => bus.emit({ type: 'run' })
function resetRun(mode, slug, question, path) {
  run.mode = mode
  run.slug = slug || ''
  run.path = path || ''
  run.question = question || ''
  run.running = true
  run.pct = 4
  run.stageKey = 'st_running'
  run.stream = ''
  run.error = ''
  run.errorKey = ''
  run.errorVars = null
  run.rawOutput = ''
  run.rawPath = ''
  run.diff = null
  run.diffFrom = 0
  run.controller = new AbortController()
  emit()
}
function trackAchievement(ev, n) {
  if (!ctx.achievements) return
  try { ctx.achievements.track(ev, n) } catch { /* ignore */ }
}
/** 「引注全部可达」按 slug 去重:成就说的是「5 **份**档案」,不是「体检了 5 次」。 */
function markCleanCites(slug) {
  const id = String(slug || '')
  if (!id) return
  let seen = []
  try { const raw = JSON.parse(getLS('cleanSlugs', '[]')); if (Array.isArray(raw)) seen = raw.map((x) => String(x)) } catch { seen = [] }
  if (seen.includes(id)) return
  seen.push(id)
  setLS('cleanSlugs', JSON.stringify(seen.slice(-200)))
  trackAchievement('clean_cites')
}
/** UI 入口的统一收尾:同步抛与异步 reject 都落成一条可读通知,不留未捕获 rejection。 */
function fire(fn) {
  const bad = (e) => say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' })
  try {
    const r = fn()
    if (r && typeof r.catch === 'function') r.catch(bad)
  } catch (e) { bad(e) }
}

/** 一轮深研:解析失败绝不写档案;报错版本保持不变。 */
async function runResearch(slug, opts) {
  const o = opts || {}
  const path = o.path || ''
  if (run.running) { say(t('busy'), { level: 'warning' }); return }
  let seed
  try { seed = await readDossier(slug, path) }
  catch (e) { say(t('read_failed', { msg: String((e && e.message) || e) }), { level: 'error' }); return }
  if (!seed) { say(t('read_failed', { msg: slug }), { level: 'error' }); return }
  const cfg = await getCfg()
  if (!cfg.backendUrl) { say(t('no_engine'), { level: 'error' }); return }
  if (!cfg.token) { say(t('need_login'), { level: 'error' }); return }
  resetRun('research', slug, seed.fm.question, path)
  if (o.openView && ctx.openView) { try { ctx.openView('run') } catch { /* ignore */ } }
  const sig = run.controller.signal
  try {
    const msg = buildResearchMessage(seed, roundsSetting(), maxSourcesSetting())
    // 流式区每来一个 token 就 emit → render → 整块 renderMarkdown 重建 DOM = O(n²),长跑必卡。
    // 按**长度增量**节流(不是时钟:check 冻了 Date.now,时钟节流会把测试里的更新全吃掉),
    // 且不引入任何定时器 —— 落在增量之间的最后一段由 done 之后那次 emit 补齐。
    let lastLen = -1
    const out = await runAgent(cfg, uuid(), msg, (full) => {
      run.stream = full
      if (full.length - lastLen < 120) return
      lastLen = full.length
      emit()
    }, sig, {
      host: true,
      onStage: (pct, key) => { run.pct = Math.max(run.pct, pct); run.stageKey = key; emit() },
    })
    const parsed = parseAgentOutput(out)
    if (!parsed.ok) {
      run.rawOutput = String(out || '')
      throw mkErr('parse_failed')
    }
    run.pct = 96
    run.stageKey = 'st_done'
    emit()
    // 读-改-写全程在写队列里,且**落盘前重读文件**:run 跑了几分钟,用户可能手改过源码,
    // 也可能有别的档案操作插队。用磁盘现状当基底,把这一轮的产出合流上去。
    const res = await enqueueWrite(async () => {
      let fresh
      try { fresh = await readDossier(slug, path) }
      catch { throw mkErr('read_failed', { msg: slug }) }
      if (!fresh) throw mkErr('read_failed', { msg: slug })
      const beforeText = serializeDossier(fresh)
      const beforeModel = parseDossier(beforeText)
      const digestBefore = bodyDigest(fresh)
      applyRound(fresh, parsed.data, maxSourcesSetting())
      if (bodyDigest(fresh) === digestBefore) return { changed: false, version: fresh.fm.version }
      await persistModel(fresh, { bump: true, snapshotText: beforeText, path })
      return { changed: true, version: fresh.fm.version, diff: diffVersions(beforeModel, fresh), claims: fresh.claims.length }
    })
    run.running = false
    // 落盘完成停在 96(「落盘」路标),100% 留给整条链真正结束 —— 自动体检还没跑,
    // 进度条写 100% 却配着「逐条请求链接中」是在骗人。
    run.pct = 96
    run.stageKey = 'st_done'
    setLS('lastSlug', slug)
    if (!res.changed) {
      run.diff = { claimsAdded: [], claimsChanged: [], claimsRemoved: [], sourcesAdded: [], gapsClosed: [] }
      run.diffFrom = res.version
      run.pct = 100
      emit()
      say(t('research_nochange', { n: res.version }), { level: 'info' })
      return
    }
    run.diff = res.diff
    run.diffFrom = res.version - 1
    emit()
    trackAchievement('dossier_done')
    trackAchievement('dossier_round')
    try { ctx.activity?.log('research_done', { slug, version: res.version, claims: res.claims }) } catch { /* ignore */ }
    say(t('research_done', { n: res.version }), { level: 'success' })
    bus.emit({ type: 'index' })
    if (autoCheckSetting()) await checkDossier(slug, { quiet: true, path })
    run.pct = 100
    run.stageKey = 'st_done'
    emit()
  } catch (e) {
    const aborted = sig.aborted
    run.running = false
    run.errorKey = aborted ? 'canceled' : (e && e.msgKey) || ''
    run.errorVars = aborted ? null : (e && e.msgVars) || null
    run.error = run.errorKey ? '' : String((e && e.message) || e)
    emit()
    if (!aborted) say(errText(), { level: 'error' })
  } finally {
    run.controller = null
    emit()
  }
}
/**
 * 把模型这一轮的产出**合流**进档案(id 分配 / 源判重 / 引用翻译 / 日志追加,全在纯函数里)。
 *
 * 断言是**增量合流,不是整份替换**:模型这一轮没提到的既有断言原样留下,`prev` 命中则就地替换,
 * 只有出现在 `drop` 里才移除。源那边本来就是合并的 —— 断言若整份替换,任何按字面理解指令、
 * 第二轮只回新断言的模型都会把上一轮的成果连同引注一起抹掉,而且不可逆(快照虽在,用户不会知道)。
 */
function applyRound(model, data, maxSources) {
  const existingIds = model.claims.map((c) => c.id)
  const existSet = new Set(existingIds)
  const rec = reconcileClaimIds(existingIds, data.claims, model.fm.nextClaim)
  const replacedBy = new Map()
  const freshClaims = []
  for (const c of rec.claims) {
    if (existSet.has(c.id) && !replacedBy.has(c.id)) replacedBy.set(c.id, c)
    else freshClaims.push(c)
  }
  const dropped = new Set(Array.isArray(data.drop) ? data.drop : [])
  // 保留下来的旧断言(含被替换的那些)也要计入引用次数,否则 maxSources 截断会把
  // 只被旧断言引用的源当成「无人引用」优先砍掉,连带丢掉已有判据。
  const kept = model.claims.filter((c) => !replacedBy.has(c.id) && !dropped.has(c.id))
  const merged = mergeSources(model.sources, data.sources, model.fm.nextSource, {
    max: maxSources,
    cites: rec.claims.map((c) => c.rawCites).concat(kept.map((c) => c.cites || [])),
  })
  const have = new Set(merged.sources.map((s) => s.id))
  const translate = (rawCites) => {
    const cites = []
    for (const raw of rawCites || []) {
      const id = merged.keyMap[String(raw)] || (/^S\d+$/.test(String(raw)) ? String(raw) : '')
      if (id && have.has(id) && !cites.includes(id)) cites.push(id)
    }
    return cites
  }
  const carry = (c) => {
    const cites = (c.cites || []).filter((id) => have.has(id))
    return { id: c.id, title: c.title || '', body: c.body || '', cites, support: cites.length ? (c.support || 'NOT_FOUND') : 'NOT_FOUND' }
  }
  const claims = []
  for (const old of model.claims) {
    const rep = replacedBy.get(old.id)
    if (rep) {
      // 空壳替换(标题与正文都空)不算替换:留住旧内容,别让一次口误清空一条断言
      if (!rep.title && !rep.body) { claims.push(carry(old)); continue }
      const cites = translate(rep.rawCites)
      claims.push({ id: rep.id, title: rep.title, body: rep.body, cites, support: cites.length ? rep.support : 'NOT_FOUND' })
      continue
    }
    if (dropped.has(old.id)) continue
    claims.push(carry(old))
  }
  for (const c of freshClaims) {
    if (!c.title && !c.body) continue
    const cites = translate(c.rawCites)
    claims.push({ id: c.id, title: c.title, body: c.body, cites, support: cites.length ? c.support : 'NOT_FOUND' })
  }
  model.claims = claims
  model.sources = merged.sources
  model.fm.nextClaim = rec.nextClaim
  model.fm.nextSource = merged.nextSource
  if (collapse(data.summary)) model.summary = String(data.summary).trim()
  if (Array.isArray(data.gaps)) model.gaps = data.gaps
  const roundNo = (model.fm.rounds | 0) + 1
  model.fm.rounds = roundNo
  const queries = []
  for (const l of data.log || []) { for (const q of (l && l.queries) || []) { const s = collapse(q); if (s && !queries.includes(s)) queries.push(s) } }
  const lang = model.fm.lang
  const iso = new Date(Date.now()).toISOString()
  const qs = queries.slice(0, 8).map((q) => (lang === 'en' ? `"${q}"` : `「${q}」`)).join(lang === 'en' ? ', ' : '')
  model.log = (model.log || []).concat([lang === 'en'
    ? `Round ${roundNo} · ${iso} · queries: ${qs || '—'} · ${model.sources.length} sources / ${model.claims.length} claims`
    : `第 ${roundNo} 轮 · ${iso} · 查询:${qs || '—'} · 共 ${model.sources.length} 源 / ${model.claims.length} 断言`])
  return model
}

/** 引注体检:探测失败绝不降级已存判据,只把本次没拿到数据的标「未体检」。 */
async function checkDossier(slug, opts) {
  const o = opts || {}
  const path = o.path || ''
  if (run.probeRunning) { if (!o.quiet) say(t('busy'), { level: 'warning' }); return }
  let model
  try { model = await readDossier(slug, path) }
  catch (e) { if (!o.quiet) say(t('read_failed', { msg: String((e && e.message) || e) }), { level: 'error' }); return }
  if (!model) return
  const urls = model.sources.map((s) => s.url).filter((u) => normalizeUrl(u))
  if (!urls.length) { if (!o.quiet) say(t('no_urls'), { level: 'warning' }); return }
  run.slug = slug
  run.path = path
  const res = await probeUrls(urls, { scope: 'dossier', slug, name: model.fm.question })
  if (!res.ok) { if (!o.quiet) say(t('check_failed'), { level: 'warning' }); return }
  const at = new Date(Date.now()).toISOString()
  // 队列体里 writeFile / readIndex 都可能 reject,而三个调用点都是 `void checkDossier(...)`:
  // 不在这里接住就是未捕获 rejection(真机门禁第 10 项)。
  try {
    await enqueueWrite(async () => {
      // 体检也在写队列里重读:判据只贴到磁盘现状上,绝不用几分钟前的内存副本整份覆写用户的手改。
      let fresh
      try { fresh = await readDossier(slug, path) } catch { fresh = null }
      if (!fresh) return
      let touched = false
      for (const s of fresh.sources) {
        const key = normalizeUrl(s.url)
        const p = key ? res.byUrl[key] : null
        const v = verdictOf(p)
        if (v.reason === 'not_probed') continue // 本次没拿到数据:保留 last known
        s.verdict = { level: v.level, reason: v.reason, at }
        touched = true
      }
      if (!touched) return
      // 体检不是内容变更:不 bump 版本、不写历史快照(bodyDigest 刻意不含判据)
      await ctx.app.writeFile(path || dossierPath(slug), serializeDossier(fresh))
      await upsertIndex(fresh, path || dossierPath(slug))
      const hs = healthSummary(fresh)
      if (fresh.sources.length && hs.live === fresh.sources.length) markCleanCites(fresh.fm.slug || slug)
    })
  } catch (e) {
    say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' })
    return
  }
  try { ctx.activity?.log('cites_checked', { slug, urls: urls.length }) } catch { /* ignore */ }
  if (!o.quiet) say(t('check_done', { n: urls.length }), { level: 'success' })
  bus.emit({ type: 'index' })
}
/** 驱动一次探测 run,返回 {ok, byUrl}。判定不在这里做 —— 只把原始探测数据按归一 URL 索引起来。 */
async function probeUrls(urls, meta) {
  const m = meta || {}
  const cfg = await getCfg()
  run.probeScope = m.scope || ''
  run.noteName = m.name || ''
  run.probeError = ''
  run.probeErrorKey = ''
  // 单篇体检借用同一块面板:把上一次深研留下的课题抬头清掉,免得显示成别的课题
  if (m.scope === 'note') { run.question = ''; run.slug = ''; run.path = '' }
  else if (m.scope === 'dossier') { run.question = m.name || '' }
  if (!cfg.backendUrl || !cfg.token) {
    run.probeErrorKey = cfg.backendUrl ? 'need_login' : 'no_engine'
    emit()
    return { ok: false, byUrl: {} }
  }
  run.probeRunning = true
  run.stageKey = 'st_probing'
  run.pct = Math.max(run.pct, 88)
  run.probes = urls.map((u) => ({ url: u, host: hostOf(u), level: '', reason: 'not_probed', at: '' }))
  run.probeController = new AbortController()
  const sig = run.probeController.signal
  emit()
  try {
    const out = await runAgent(cfg, uuid(), buildProbeMessage(urls), null, sig, { host: true })
    const parsed = parseProbeJson(out)
    const byUrl = {}
    if (parsed.ok) { for (const p of parsed.probes) { const k = normalizeUrl(p.url); if (k) byUrl[k] = p } }
    run.probes = applyProbes(urls, parsed, new Date(Date.now()).toISOString())
    run.probeAt = Date.now()
    run.probeRunning = false
    run.pct = 100
    if (!parsed.ok) run.probeErrorKey = 'check_failed'
    emit()
    return { ok: parsed.ok, byUrl }
  } catch (e) {
    run.probeRunning = false
    if (sig.aborted) { run.probeErrorKey = 'canceled'; run.probeError = '' }
    else { run.probeError = String((e && e.message) || e); run.probeErrorKey = '' }
    emit()
    return { ok: false, byUrl: {} }
  } finally {
    run.probeController = null
  }
}
/**
 * 把探针结果贴回**请求过的那批 URL**(纯函数,check 直接钉这条路径)。
 * 整体解析失败 → 全部 UNKNOWN(不是 DEAD);探针里多出来的 URL 天然进不了结果。
 */
function applyProbes(urls, parsed, at) {
  const byUrl = {}
  if (parsed && parsed.ok) { for (const p of parsed.probes || []) { const k = normalizeUrl(p.url); if (k) byUrl[k] = p } }
  return (urls || []).map((u) => {
    const p = parsed && parsed.ok ? byUrl[normalizeUrl(u)] : null
    const v = verdictOf(p)
    return { url: u, host: hostOf(u), level: v.level, reason: v.reason, at: v.reason === 'not_probed' ? '' : String(at || '') }
  })
}

// ── 命令实现 ─────────────────────────────────────────────────────────────────
async function createDossier(question, folder) {
  const q = collapse(question)
  if (!q) { say(t('need_question'), { level: 'warning' }); return null }
  const model = newModel(q, L())
  const dir = folder ? String(folder).replace(/\/+$/, '') : ''
  const at = (slug) => (dir ? `${dir}/${slug}.dossier.md` : dossierPath(slug))
  // 建在笔记附件夹里的档案(斜杠 / 右键新建)也进索引并记下真实 path —— 否则课题台看不到它,
  // 「续研 / 体检」也会去工作文件夹里找一个不存在的同名文件。
  let made
  try {
    made = await enqueueWrite(async () => {
      // 「这个 slug 被占了吗」的判据是**磁盘**,不是索引:索引会被「移出列表」删掉条目
      // (README 明写不删文件)、会被损坏后重置、也覆盖不到手工拷进来的档案 ——
      // 只问索引 = 同名课题重开时无声覆写既有档案,且新档 version 0 连快照都不落。
      const base = slugifyTopic(q)
      let slug = base
      for (let i = 2; i < 999; i++) {
        const cur = await ctx.app.readFile(at(slug))
        if (cur == null) break
        slug = `${base}-${i}`
      }
      if ((await ctx.app.readFile(at(slug))) != null) slug = `${base}-${Date.now()}`
      model.fm.slug = slug
      model.fm.updated = new Date(Date.now()).toISOString()
      const path = at(slug)
      await ctx.app.writeFile(path, serializeDossier(model))
      await upsertIndex(model, path)
      return { slug, path }
    })
  } catch (e) {
    // readFile 真抛(IO 故障)= 拿不准这个 path 上有没有东西 → 宁可不建,绝不冒覆写的险
    say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' })
    return null
  }
  setLS('lastSlug', made.slug)
  bus.emit({ type: 'index' })
  return made
}
async function cmdNew() {
  try {
    if (!ctx.app.prompt) { if (ctx.openView) ctx.openView('desk'); return }
    const v = await ctx.app.prompt(t('ask_question'), '')
    if (v == null || !collapse(v)) return
    const made = await createDossier(v)
    if (!made) return
    if (ctx.openView) ctx.openView('run')
    setLS('lastPath', made.path)
    await runResearch(made.slug, { path: made.path })
  } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
}
async function cmdContinue() {
  const slug = getLS('lastSlug', '')
  if (!slug) { say(t('no_last'), { level: 'warning' }); return }
  if (ctx.openView) ctx.openView('run')
  await runResearch(slug, { path: getLS('lastPath', '') })
}
/** 单篇场景(吸收 link-doctor):只出并排报告,**绝不回写活动页**。 */
async function cmdCheckNote() {
  let text = ''
  try { text = ctx.app.getActivePageText ? ctx.app.getActivePageText() : '' } catch { text = '' }
  let name = ''
  try { name = (ctx.app.getActivePage && ctx.app.getActivePage()) || '' } catch { name = '' }
  if (!text) { say(t('no_active'), { level: 'warning' }); return }
  const urls = extractUrls(text)
  if (!urls.length) { say(t('no_urls'), { level: 'warning' }); return }
  if (ctx.openView) ctx.openView('run')
  // 拿不到笔记名时留**空串**,别兜成 t('src_of_note'):这个值会进「另存报告」的文件名
  // (`<日期>-<笔记名>.md`),取 t() 等于英文界面下建出来的报告文件跟中文界面不是同一个。
  // 界面上的兜底显示在 render 里按语言取,落盘那半用 sanitizeFileName 的 ASCII 兜底。
  const base = name ? String(name).split('/').pop().replace(/\.md$/i, '') : ''
  const res = await probeUrls(urls, { scope: 'note', name: base })
  if (!res.ok) { say(t('check_failed'), { level: 'warning' }); return }
  try { ctx.activity?.log('cites_checked', { note: base, urls: urls.length }) } catch { /* ignore */ }
  say(t('check_done', { n: urls.length }), { level: 'success' })
}
function probeReportMarkdown() {
  const lang = L()
  const lines = [`# ${t('note_report_head')}`, '']
  lines.push(`> ${t('note_report_src')}: ${run.noteName || '-'} · ${new Date(Date.now()).toISOString()}`)
  lines.push('')
  for (const p of run.probes) {
    const label = MSG[lang][VERDICT_KEY[p.level] || 'v_unchecked'] || ''
    lines.push(`- [${p.level || 'UNCHECKED'}] ${label} — ${p.url}`)
    if (p.reason) lines.push(`  - ${p.reason}${p.at ? ' · ' + p.at : ''}`)
  }
  lines.push('')
  return lines.join('\n')
}
async function saveProbeReport() {
  try {
    const path = `${reportDir()}/${dayKeyOf(Date.now())}-${sanitizeFileName(run.noteName || 'links')}.md`
    await enqueueWrite(() => ctx.app.writeFile(path, probeReportMarkdown()))
    say(t('report_saved', { path }), { level: 'success' })
    if (ctx.app.openFile) ctx.app.openFile(path)
  } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
}
async function saveRawOutput() {
  if (!run.rawOutput) return
  try {
    const path = `${historyDir(run.slug || 'unknown')}/failed-${Date.now()}.txt`
    await enqueueWrite(() => ctx.app.writeFile(path, run.rawOutput))
    run.rawPath = path
    emit()
    say(t('raw_saved', { path }), { level: 'success' })
  } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
}
/** 修复路径(非快乐路径):Agent 只跑一条 ls 列出工作文件夹下的 *.dossier.md,插件逐个读回重建索引。 */
async function recoverDossiers() {
  const cfg = await getCfg()
  if (!cfg.backendUrl || !cfg.token) { say(cfg.backendUrl ? t('need_login') : t('no_engine'), { level: 'warning' }); return }
  run.recoverController = new AbortController()
  const sig = run.recoverController.signal
  try {
    const folder = wfRoot()
    const msg = `List the dossier files in one Amadeus vault folder. Use run_bash exactly once. Do not read, write or modify any file.

Command: ls -1 "<vault absolute path>/${folder}" | grep '\\.dossier\\.md$'

The vault absolute path was given to you in your system prompt. Output exactly one fenced json block and nothing else:

\`\`\`json
{"files":["some-slug.dossier.md"]}
\`\`\``
    const out = await runAgent(cfg, uuid(), msg, null, sig, { host: true })
    let names = []
    const fence = /```(?:json)?[^\n]*\n([\s\S]*?)```/i.exec(String(out || ''))
    if (fence) { try { const j = JSON.parse(fence[1]); if (j && Array.isArray(j.files)) names = j.files } catch { /* ignore */ } }
    let n = 0
    for (const f of names) {
      if (sig.aborted) break
      const slug = String(f).split('/').pop().replace(/\.dossier\.md$/i, '')
      if (!slug) continue
      let m
      try { m = await readDossier(slug) } catch { m = null }
      if (!m) continue
      if (!m.fm.slug) m.fm.slug = slug
      await enqueueWrite(() => upsertIndex(m, dossierPath(slug)))
      n += 1
    }
    if (sig.aborted) { say(t('canceled'), { level: 'info' }); return }
    say(t('recovered', { n }), { level: n ? 'success' : 'info' })
    bus.emit({ type: 'index' })
  } catch (e) {
    if (sig.aborted) say(t('canceled'), { level: 'info' })
    else say(t('recover_fail', { msg: String((e && e.message) || e) }), { level: 'error' })
  } finally { run.recoverController = null }
}
async function forgetSlug(slug) {
  try {
    if (ctx.app.prompt) {
      const ok = await ctx.app.prompt(t('confirm_remove'), '')
      if (ok == null || String(ok).trim().toLowerCase() !== 'y') return
    }
    await enqueueWrite(async () => {
      const idx = await readIndex()
      idx.items = idx.items.filter((x) => x.slug !== slug)
      await writeIndex(idx)
    })
    say(t('removed'), { level: 'success' })
    bus.emit({ type: 'index' })
  } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
}

// ══ 视图一:课题台 desk(必须第一个注册 —— 真机台架默认开首个视图) ═══════════
function mountDesk(el) {
  el.textContent = ''
  const styleEl = h('style')
  styleEl.textContent = STYLE
  el.appendChild(styleEl)
  const rootEl = h('div', 'ds-root')
  el.appendChild(rootEl)
  const wrap = h('div', 'ds-wrap')
  rootEl.appendChild(wrap)
  const offTheme = themeObserver(rootEl)

  let items = []
  let loading = true
  let loadError = ''
  let draft = ''

  const head = h('div', 'ds-head')
  const titleEl = h('span', 'ds-title', '')
  const subEl = h('div', 'ds-sub', '')
  head.appendChild(titleEl)
  wrap.appendChild(head)
  wrap.appendChild(subEl)

  const askCard = h('div', 'ds-card')
  const ta = h('textarea', 'ds-ta')
  ta.setAttribute('rows', '2')
  ta.addEventListener('input', () => { draft = String(ta.value || '') })
  const askRow = h('div', 'ds-row')
  const startBtn = mkBtn('', 'primary', () => fire(() => doStart()))
  askRow.appendChild(h('span', 'ds-flex1'))
  askRow.appendChild(startBtn)
  askCard.appendChild(ta)
  askCard.appendChild(askRow)
  wrap.appendChild(askCard)

  const listLabel = h('div', 'ds-label', '')
  wrap.appendChild(listLabel)
  const listBox = h('div', 'ds-row')
  listBox.style.flexDirection = 'column'
  listBox.style.alignItems = 'stretch'
  wrap.appendChild(listBox)

  const footRow = h('div', 'ds-row')
  const recoverBtn = mkBtn('', 'sm', () => fire(() => recoverDossiers()))
  footRow.appendChild(h('span', 'ds-flex1'))
  footRow.appendChild(recoverBtn)
  wrap.appendChild(footRow)

  async function doStart() {
    const q = collapse(draft || ta.value || '')
    if (!q) { say(t('need_question'), { level: 'warning' }); return }
    startBtn.disabled = true
    try {
      const made = await createDossier(q)
      if (!made) return
      ta.value = ''
      draft = ''
      await load()
      if (ctx.openView) ctx.openView('run')
      setLS('lastPath', made.path)
      await runResearch(made.slug, { path: made.path })
    } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
    finally { startBtn.disabled = false; render() }
  }
  async function load() {
    loading = true
    loadError = ''
    render()
    try { const idx = await readIndex(); items = idx.items }
    catch (e) { loadError = String((e && e.message) || e) }
    loading = false
    render()
  }
  function healthChips(row, hs) {
    const mk = (level, n) => {
      if (!n) return
      const b = h('span', `ds-badge ${VERDICT_CLS[level]}`, `${MSG[L()][VERDICT_KEY[level]]} ${n}`)
      b.setAttribute('title', t(VERDICT_TIP[level]))
      row.appendChild(b)
    }
    mk('LIVE', hs.live)
    mk('DEAD', hs.dead)
    mk('LIKELY_HALLUCINATED', hs.suspect)
    mk('UNKNOWN', hs.unknown)
  }
  function render() {
    titleEl.textContent = t('desk_title')
    subEl.textContent = t('desk_sub')
    ta.setAttribute('placeholder', t('q_placeholder'))
    startBtn.textContent = t('btn_start')
    listLabel.textContent = t('list_title')
    recoverBtn.textContent = t('btn_recover')
    listBox.textContent = ''
    if (loading) { listBox.appendChild(h('div', 'ds-empty', t('loading'))); return }
    if (loadError) {
      const e = h('div', 'ds-empty')
      e.appendChild(h('b', null, t('err_load')))
      e.appendChild(h('div', 'ds-err', loadError))
      e.appendChild(mkBtn(t('btn_retry'), 'sm', () => fire(() => load())))
      listBox.appendChild(e)
      return
    }
    if (!items.length) {
      const e = h('div', 'ds-empty')
      e.appendChild(h('b', null, t('desk_empty_title')))
      e.appendChild(h('div', null, t('desk_empty_body')))
      listBox.appendChild(e)
      return
    }
    for (const it of items) {
      const card = h('div', 'ds-item')
      card.setAttribute('data-slug', it.slug)
      card.appendChild(h('div', 'ds-q', it.question || it.slug))
      const meta = h('div', 'ds-meta')
      meta.appendChild(h('span', null, t('col_version', { n: it.version | 0 })))
      meta.appendChild(h('span', null, t('col_claims', { n: it.claims | 0 })))
      meta.appendChild(h('span', null, t('col_sources', { n: it.sources | 0 })))
      if (it.updated) meta.appendChild(h('span', null, fmtDate(it.updated)))
      card.appendChild(meta)
      const chips = h('div', 'ds-row')
      healthChips(chips, it.health || { live: 0, dead: 0, suspect: 0, unknown: 0 })
      card.appendChild(chips)
      const acts = h('div', 'ds-row')
      const at = it.path || dossierPath(it.slug)
      acts.appendChild(mkBtn(t('btn_open'), 'sm', () => { setLS('lastSlug', it.slug); setLS('lastPath', at); if (ctx.app.openFile) ctx.app.openFile(at) }))
      acts.appendChild(mkBtn(t('btn_continue'), 'sm', () => { setLS('lastSlug', it.slug); setLS('lastPath', at); fire(() => runResearch(it.slug, { openView: true, path: at })) }))
      acts.appendChild(mkBtn(t('btn_check'), 'sm', () => { setLS('lastSlug', it.slug); setLS('lastPath', at); if (ctx.openView) ctx.openView('run'); fire(() => checkDossier(it.slug, { path: at })) }))
      acts.appendChild(h('span', 'ds-flex1'))
      acts.appendChild(mkBtn(t('btn_forget'), 'sm', () => fire(() => forgetSlug(it.slug))))
      card.appendChild(acts)
      listBox.appendChild(card)
    }
  }

  render()
  rerenders.add(render)
  const offBus = bus.on((e) => { if (e && e.type === 'index') fire(() => load()) })
  void load().catch(() => { loading = false; render() })
  return () => { rerenders.delete(render); offBus(); offTheme() }
}

// ══ 视图二:检索台 run ═══════════════════════════════════════════════════════
function mountRun(el) {
  el.textContent = ''
  const styleEl = h('style')
  styleEl.textContent = STYLE
  el.appendChild(styleEl)
  const rootEl = h('div', 'ds-root')
  el.appendChild(rootEl)
  const wrap = h('div', 'ds-wrap')
  rootEl.appendChild(wrap)
  const offTheme = themeObserver(rootEl)

  const head = h('div', 'ds-head')
  const titleEl = h('span', 'ds-title', '')
  head.appendChild(titleEl)
  head.appendChild(h('span', 'ds-flex1'))
  // 体检也是一条在飞的 run:只 abort run.controller 的话,自动体检整段取消按钮是死的
  const cancelBtn = mkBtn('', 'sm', () => {
    for (const c of [run.controller, run.probeController]) { if (c) { try { c.abort() } catch { /* ignore */ } } }
  })
  head.appendChild(cancelBtn)
  wrap.appendChild(head)
  const qEl = h('div', 'ds-sub', '')
  wrap.appendChild(qEl)

  const progCard = h('div', 'ds-card')
  const steps = h('div', 'ds-steps')
  const track = h('div', 'ds-track')
  const fill = h('div', 'ds-fill')
  track.appendChild(fill)
  const stageRow = h('div', 'ds-meta')
  const stageEl = h('span', null, '')
  const pctEl = h('span', null, '')
  stageRow.appendChild(stageEl)
  stageRow.appendChild(h('span', 'ds-flex1'))
  stageRow.appendChild(pctEl)
  progCard.appendChild(steps)
  progCard.appendChild(track)
  progCard.appendChild(stageRow)
  wrap.appendChild(progCard)

  const errBox = h('div')
  wrap.appendChild(errBox)
  const streamCard = h('div', 'ds-card')
  const streamLabel = h('div', 'ds-label', '')
  const streamBox = h('div', 'ds-stream')
  streamCard.appendChild(streamLabel)
  streamCard.appendChild(streamBox)
  wrap.appendChild(streamCard)

  const diffBox = h('div')
  wrap.appendChild(diffBox)

  const probeCard = h('div', 'ds-card')
  const probeHead = h('div', 'ds-row')
  const probeLabel = h('div', 'ds-label', '')
  const probeCount = h('span', 'ds-hint', '')
  const recheckBtn = mkBtn('', 'sm', () => {
    if (run.probeScope === 'note') fire(() => cmdCheckNote())
    else if (run.slug) fire(() => checkDossier(run.slug, { path: run.path }))
  })
  const saveReportBtn = mkBtn('', 'sm', () => fire(() => saveProbeReport()))
  probeHead.appendChild(probeLabel)
  probeHead.appendChild(probeCount)
  probeHead.appendChild(h('span', 'ds-flex1'))
  probeHead.appendChild(recheckBtn)
  probeHead.appendChild(saveReportBtn)
  const probeList = h('div', 'ds-probe')
  probeCard.appendChild(probeHead)
  probeCard.appendChild(probeList)
  wrap.appendChild(probeCard)

  const idleBox = h('div')
  wrap.appendChild(idleBox)

  function render() {
    titleEl.textContent = t('run_title')
    qEl.textContent = run.question || (run.probeScope === 'note' ? (run.noteName || t('src_of_note')) : '')
    cancelBtn.textContent = t('btn_cancel')
    cancelBtn.disabled = !(run.running || run.probeRunning)
    const active = run.running || run.pct > 0 || !!(run.error || run.errorKey)
    progCard.style.display = active ? '' : 'none'
    steps.textContent = ''
    for (const s of STEPS) {
      const on = run.pct >= s[1]
      steps.appendChild(h('span', `ds-step${on ? ' on' : ''}`, t(s[0])))
    }
    fill.style.width = `${Math.min(100, Math.max(0, run.pct))}%`
    stageEl.textContent = run.stageKey ? t(run.stageKey) : ''
    pctEl.textContent = `${Math.round(Math.min(100, run.pct))}%`

    errBox.textContent = ''
    if (run.error || run.errorKey) {
      const c = h('div', 'ds-card')
      c.appendChild(h('div', 'ds-err', errText()))
      const r = h('div', 'ds-row')
      r.appendChild(h('span', 'ds-flex1'))
      if (run.rawOutput && !run.rawPath) r.appendChild(mkBtn(t('btn_save_raw'), 'sm', () => fire(() => saveRawOutput())))
      if (run.rawPath) r.appendChild(h('span', 'ds-hint', run.rawPath))
      if (run.slug) r.appendChild(mkBtn(t('btn_retry'), 'sm', () => { run.error = ''; run.errorKey = ''; fire(() => runResearch(run.slug, { path: run.path })) }))
      r.appendChild(mkBtn(t('btn_dismiss'), 'sm', () => { run.error = ''; run.errorKey = ''; run.rawOutput = ''; render() }))
      c.appendChild(r)
      errBox.appendChild(c)
    }

    const showStream = !!(run.stream || run.rawOutput)
    streamCard.style.display = showStream ? '' : 'none'
    streamLabel.textContent = t('stream_title')
    if (showStream) renderMarkdown(streamBox, run.stream || run.rawOutput)

    diffBox.textContent = ''
    if (run.diff) {
      const c = h('div', 'ds-card')
      const dh = h('div', 'ds-row')
      dh.appendChild(h('div', 'ds-label', t('diff_title')))
      if (run.diffFrom > 0) dh.appendChild(h('span', 'ds-hint', t('col_version', { n: run.diffFrom })))
      c.appendChild(dh)
      const d = run.diff
      const total = d.claimsAdded.length + d.claimsChanged.length + d.claimsRemoved.length + d.sourcesAdded.length
      if (!total) c.appendChild(h('div', 'ds-hint', t('diff_none')))
      else {
        const r = h('div', 'ds-row')
        r.appendChild(h('span', 'ds-chip', t('diff_added', { n: d.claimsAdded.length })))
        r.appendChild(h('span', 'ds-chip', t('diff_changed', { n: d.claimsChanged.length })))
        r.appendChild(h('span', 'ds-chip', t('diff_removed', { n: d.claimsRemoved.length })))
        r.appendChild(h('span', 'ds-chip', t('diff_src', { n: d.sourcesAdded.length })))
        c.appendChild(r)
      }
      diffBox.appendChild(c)
    }

    const hasProbes = run.probes.length > 0 || run.probeRunning || !!(run.probeError || run.probeErrorKey)
    probeCard.style.display = hasProbes ? '' : 'none'
    probeLabel.textContent = t('cites_title')
    probeCount.textContent = run.probes.length ? t('cites_count', { n: run.probes.length }) : ''
    recheckBtn.textContent = t('btn_recheck')
    recheckBtn.disabled = run.probeRunning
    saveReportBtn.textContent = t('btn_save_report')
    saveReportBtn.disabled = !run.probes.length
    probeList.textContent = ''
    if (run.probeError || run.probeErrorKey) probeList.appendChild(h('div', 'ds-err', probeErrText()))
    for (const p of run.probes) {
      const row = h('div', 'ds-prow')
      const level = p.level || ''
      const badge = h('span', `ds-badge ${VERDICT_CLS[level] || 'unknown'}`, level ? MSG[L()][VERDICT_KEY[level]] : t('v_unchecked'))
      badge.setAttribute('title', t(level ? VERDICT_TIP[level] : 'tip_unchecked'))
      row.appendChild(badge)
      if (p.host) row.appendChild(h('span', 'ds-why', p.host))
      row.appendChild(h('span', 'ds-purl', p.url))
      if (p.reason) row.appendChild(h('span', 'ds-why', p.reason))
      if (p.at) row.appendChild(h('span', 'ds-why', fmtDate(p.at)))
      probeList.appendChild(row)
    }

    idleBox.textContent = ''
    if (!active && !hasProbes) {
      const e = h('div', 'ds-empty')
      e.appendChild(h('b', null, t('run_idle_title')))
      e.appendChild(h('div', null, t('run_idle_body')))
      idleBox.appendChild(e)
    }
  }

  render()
  rerenders.add(render)
  const offBus = bus.on((e) => { if (e && e.type === 'run') render() })
  return () => { rerenders.delete(render); offBus(); offTheme() }
}

// ══ 文件类型视图:渲染档案 + 引注徽章 + </> 源码切换 ═════════════════════════
function mountDossierFile(el, filePath) {
  el.textContent = ''
  const styleEl = h('style')
  styleEl.textContent = STYLE
  el.appendChild(styleEl)
  const rootEl = h('div', 'ds-root')
  el.appendChild(rootEl)
  const wrap = h('div', 'ds-wrap')
  rootEl.appendChild(wrap)
  const offTheme = themeObserver(rootEl)

  let text = ''
  let model = null
  let editing = false
  let loading = true
  let err = ''
  // 初值 null(不是 ''):`dirty || text` 会把用户「把源码清空后保存」静默还原成旧内容
  let dirty = null

  const head = h('div', 'ds-head')
  const titleEl = h('span', 'ds-title', '')
  head.appendChild(titleEl)
  head.appendChild(h('span', 'ds-flex1'))
  const contBtn = mkBtn('', 'sm', () => { const s = slugOf(); if (s) { setLS('lastSlug', s); setLS('lastPath', filePath); fire(() => runResearch(s, { openView: true, path: filePath })) } })
  const chkBtn = mkBtn('', 'sm', () => { const s = slugOf(); if (s) { setLS('lastSlug', s); setLS('lastPath', filePath); if (ctx.openView) ctx.openView('run'); fire(() => checkDossier(s, { path: filePath })) } })
  const runBtn = mkBtn('', 'sm', () => { if (ctx.openView) ctx.openView('run') })
  const srcBtn = mkBtn('</>', 'sm', () => { editing = !editing; render() })
  head.appendChild(contBtn)
  head.appendChild(chkBtn)
  head.appendChild(runBtn)
  head.appendChild(srcBtn)
  wrap.appendChild(head)
  const warnEl = h('div', 'ds-hint', '')
  wrap.appendChild(warnEl)
  const bodyBox = h('div')
  wrap.appendChild(bodyBox)

  const slugOf = () => (model && model.fm.slug) || String(filePath || '').split('/').pop().replace(/\.dossier\.md$/i, '')

  async function load() {
    loading = true
    err = ''
    render()
    try {
      const raw = await ctx.app.readFile(filePath)
      // 宿主契约:文件缺失 / 越界给 null,空文件给 ''。把 null 折叠成 '' 再让用户按保存,
      // 写回去的是空串 —— 缺失当成错误处理,连保存入口一起关掉。
      if (raw == null) { err = t('read_failed', { msg: filePath }); model = null; text = '' }
      else { text = raw; model = parseDossier(text) }
    } catch (e) { err = String((e && e.message) || e) }
    loading = false
    render()
  }
  async function save(next) {
    try {
      await enqueueWrite(async () => { await ctx.app.writeFile(filePath, next) })
      text = next
      model = parseDossier(next)
      editing = false
      say(t('saved'), { level: 'success' })
      const s = slugOf()
      if (s && model && model.fm.slug) { await enqueueWrite(() => upsertIndex(model, filePath)).catch(() => {}) }
      bus.emit({ type: 'index' })
      render()
    } catch (e) { say(t('save_failed', { msg: String((e && e.message) || e) }), { level: 'error' }) }
  }
  function renderDoc(box) {
    const m = model
    if (!m) return
    const doc = h('div', 'ds-doc')
    if (m.fm.question) doc.appendChild(h('h1', null, m.fm.question))
    const meta = h('div', 'ds-meta')
    meta.appendChild(h('span', null, t('col_version', { n: m.fm.version | 0 })))
    meta.appendChild(h('span', null, t('col_claims', { n: m.claims.length })))
    meta.appendChild(h('span', null, t('col_sources', { n: m.sources.length })))
    if (m.fm.updated) meta.appendChild(h('span', null, fmtDate(m.fm.updated)))
    doc.appendChild(meta)
    if (m.summary) {
      doc.appendChild(h('h2', null, t('sec_summary')))
      const s = h('div')
      renderMarkdown(s, m.summary)
      doc.appendChild(s)
    }
    doc.appendChild(h('h2', null, t('sec_claims')))
    if (!m.claims.length) doc.appendChild(h('div', 'ds-hint', t('empty_claims')))
    for (const c of m.claims) {
      doc.appendChild(h('h3', null, `${c.id} · ${c.title}`))
      const b = h('div')
      renderMarkdown(b, c.body)
      doc.appendChild(b)
      const r = h('div', 'ds-row')
      r.appendChild(h('span', 'ds-chip', c.support === 'SUPPORTED' ? t('sup_yes') : t('sup_no')))
      if (!c.cites.length) r.appendChild(h('span', 'ds-badge unknown', t('no_cites')))
      for (const id of c.cites) {
        const src = m.sources.find((x) => x.id === id)
        const lv = (src && src.verdict && src.verdict.level) || ''
        const b2 = h('span', `ds-badge ${VERDICT_CLS[lv] || 'unknown'}`, id)
        b2.setAttribute('title', t(lv ? VERDICT_TIP[lv] : 'tip_unchecked'))
        r.appendChild(b2)
      }
      doc.appendChild(r)
    }
    doc.appendChild(h('h2', null, t('sec_sources')))
    if (!m.sources.length) doc.appendChild(h('div', 'ds-hint', t('cites_empty')))
    for (const s of m.sources) {
      const row = h('div', 'ds-prow')
      const lv = (s.verdict && s.verdict.level) || ''
      const badge = h('span', `ds-badge ${VERDICT_CLS[lv] || 'unknown'}`, lv ? MSG[L()][VERDICT_KEY[lv]] : t('v_unchecked'))
      badge.setAttribute('title', t(lv ? VERDICT_TIP[lv] : 'tip_unchecked'))
      row.appendChild(badge)
      row.appendChild(h('span', 'ds-why', s.id))
      const a = h('a', 'ds-purl', s.title || s.url)
      const href = safeHref(s.url)
      if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
      row.appendChild(a)
      doc.appendChild(row)
      if (s.quote) doc.appendChild(h('blockquote', null, s.quote))
    }
    if (m.gaps.length) {
      doc.appendChild(h('h2', null, t('sec_gaps')))
      const ul = h('ul')
      for (const g of m.gaps) ul.appendChild(h('li', null, g))
      doc.appendChild(ul)
    }
    if (m.log.length) {
      doc.appendChild(h('h2', null, t('sec_log')))
      const ul = h('ul')
      for (const g of m.log) ul.appendChild(h('li', null, g))
      doc.appendChild(ul)
    }
    box.appendChild(doc)
  }
  function render() {
    titleEl.textContent = (model && model.fm.question) || t('filetype_title')
    contBtn.textContent = t('btn_continue')
    chkBtn.textContent = t('btn_check')
    runBtn.textContent = t('btn_open_run')
    srcBtn.textContent = editing ? t('btn_read') : t('btn_edit_source')
    warnEl.textContent = model && (!model.hadFm || !model.fm.slug) ? t('parse_warn') : ''
    bodyBox.textContent = ''
    if (loading) { bodyBox.appendChild(h('div', 'ds-empty', t('loading'))); return }
    if (err) {
      const e = h('div', 'ds-empty')
      e.appendChild(h('b', null, t('err_load')))
      e.appendChild(h('div', 'ds-err', err))
      e.appendChild(mkBtn(t('btn_retry'), 'sm', () => fire(() => load())))
      bodyBox.appendChild(e)
      return
    }
    if (editing) {
      const ta = h('textarea', 'ds-src')
      ta.value = dirty === null ? text : dirty
      ta.addEventListener('input', () => { dirty = String(ta.value || '') })
      const r = h('div', 'ds-row')
      r.appendChild(h('span', 'ds-flex1'))
      r.appendChild(mkBtn(t('btn_cancel'), 'sm', () => { editing = false; dirty = null; render() }))
      r.appendChild(mkBtn(t('btn_save'), 'primary sm', () => { const v = dirty === null ? text : dirty; dirty = null; fire(() => save(v)) }))
      bodyBox.appendChild(ta)
      bodyBox.appendChild(r)
      return
    }
    renderDoc(bodyBox)
  }

  render()
  rerenders.add(render)
  void load().catch(() => { loading = false; render() })
  return () => { rerenders.delete(render); offTheme() }
}

// ── 设置(标签是宿主单字符串,注册时取当时语言) ──────────────────────────────
ctx.registerSetting?.({ key: 'rounds', label: t('set_rounds'), type: 'number', default: 3, min: 1, max: 6, description: t('set_rounds_desc') })
ctx.registerSetting?.({ key: 'autoCheck', label: t('set_autocheck'), type: 'boolean', default: true, description: t('set_autocheck_desc') })
ctx.registerSetting?.({ key: 'maxSources', label: t('set_max'), type: 'number', default: 12, min: 3, max: 40, description: t('set_max_desc') })

// ── 贡献点(desk 必须第一个 registerView) ───────────────────────────────────
ctx.registerView?.({ id: 'desk', title: t('view_desk'), mount: mountDesk, singleton: true, workspaceSource: 'dossier-list' })
ctx.registerView?.({ id: 'run', title: t('view_run'), mount: mountRun, singleton: true, workspaceSource: 'dossier-list' })

// ── 统一左栏列表源(宿主 2026-08-25+;可选链,老宿主静默跳过) ─────────────────────
// 课题清单交给宿主统一左栏渲染(与会话/笔记行同一套 UI);点一行 = 打开那份档案。
// 插件对界面无状态:搜索词由宿主持有,经 items({query}) 回传。课题之间无层级,故不给 groups()。
if (ctx.registerListSource) {
  let listCache = [] // items() 必须同步且便宜 —— 课题索引的同步快照,绝不在 items() 里读盘
  const listSubs = new Set()
  const fireList = () => listSubs.forEach((f) => { try { f() } catch { /* ignore */ } })
  // ⚠️ 只在 setup 里读一次不行:插件是在宿主**启动期**装的,那时活动库还没恢复,
  //    ctx.app.readFile 此刻静默给 null → 列表永久空着(青鸟 2026-08-28 实报的同一个坑)。
  //    宿主挂载列表面 / 切库都会重订阅,subscribe() 就是重读的门。
  //    读失败(readIndex 抛 ioFail)一律**保留上一份**,绝不清空成「没有课题」。
  const listReload = () => readIndex().then((idx) => { listCache = idx.items || []; fireList() }, () => { /* 保留上一份 */ })
  bus.on((e) => { if (e.type === 'index') void listReload() })
  ctx.registerListSource({
    id: 'dossier-list',
    title: t('view_desk'),
    search: true,
    items: (f) => {
      const q = ((f && f.query) || '').trim().toLowerCase()
      return listCache
        .filter((it) => it && it.slug)
        .filter((it) => !q || String(it.question || '').toLowerCase().includes(q) || String(it.slug || '').toLowerCase().includes(q))
        .map((it) => ({
          key: it.path || dossierPath(it.slug),
          title: it.question || it.slug,
          // 右侧 = 落库日期前 10 位(语言中立,不进词表)
          hint: String(it.updated || '').slice(0, 10),
          icon: 'bookmark', // 与 .dossier.md 文件类型的树图标同一枚
        }))
    },
    actions: [{ id: 'new', label: t('cmd_new'), run: () => fire(() => cmdNew()) }],
    subscribe: (cb) => { listSubs.add(cb); void listReload(); return () => listSubs.delete(cb) },
    // 与 desk 面「打开档案」同一条路:记住 last*,再交给文件类型视图。
    open: (item) => {
      const it = listCache.find((x) => (x.path || dossierPath(x.slug)) === item.key)
      if (it) { setLS('lastSlug', it.slug); setLS('lastPath', item.key) }
      if (ctx.app.openFile) ctx.app.openFile(item.key)
    },
  })
}

ctx.registerCommand?.({
  id: 'dossier-open', title: t('cmd_open'), keywords: 'dossier 深研 档案 研究 research citation 引注',
  run: () => { if (ctx.openView) ctx.openView('desk') },
})
ctx.registerCommand?.({
  id: 'dossier-new', title: t('cmd_new'), keywords: 'dossier new 深研 新课题 research question 提问',
  run: () => fire(() => cmdNew()),
})
ctx.registerCommand?.({
  id: 'dossier-continue', title: t('cmd_continue'), keywords: 'dossier continue 续研 深研 research again',
  run: () => fire(() => cmdContinue()),
})
ctx.registerCommand?.({
  id: 'dossier-check-note', title: t('cmd_checknote'), keywords: 'dossier check link 体检 链接 引注 verify url',
  run: () => fire(() => cmdCheckNote()),
})

// registerFileType 返回 false = 后缀被内置占走 → **整体退让**(跳过 creator / slash / embed)
const refused = ctx.registerFileType
  ? ctx.registerFileType({
    id: 'dossier',
    extensions: ['.dossier.md'],
    icon: 'bookmark',
    title: t('filetype_title'),
    mount: (el, file) => mountDossierFile(el, (file && file.filePath) || ''),
  }) === false
  : false
if (!refused) {
  ctx.registerFileCreator?.({
    id: 'dossier',
    label: t('creator_label'),
    icon: 'bookmark',
    run: async (parentFolder) => {
      // 按 Esc 取消 → prompt 给 null。曾经的 `q || t('ask_question')` 会把提示语本身
      // 当成课题真的建一份档案落盘;取消就是取消。
      const q = ctx.app.prompt ? await ctx.app.prompt(t('ask_question'), '') : null
      if (q == null || !collapse(q)) { if (q != null || !ctx.app.prompt) say(t('need_question'), { level: 'warning' }); return }
      const made = await createDossier(q, parentFolder || '')
      if (made && ctx.app.openFile) ctx.app.openFile(made.path)
    },
  })
  ctx.registerSlashItem?.({
    id: 'dossier-file',
    label: t('slash_label'),
    hint: t('slash_hint'),
    icon: 'bookmark',
    group: '高级',
    keywords: 'dossier 深研 档案 research 引注 citation',
    run: async (cx) => {
      const q = ctx.app.prompt ? await ctx.app.prompt(t('ask_question'), '') : null
      if (q == null || !collapse(q)) { if (q != null || !ctx.app.prompt) say(t('need_question'), { level: 'warning' }); return '' }
      const made = await createDossier(q, (cx && cx.folder) || '')
      return made ? `![[${made.path}]]` : ''
    },
  })
}

ctx.achievements?.registerSeries({
  id: 'dossier',
  title: t('ach_series'),
  achievements: [
    { id: 'first', title: t('ach_first'), desc: t('ach_first_d'), event: 'dossier_done', goal: 1, points: 10 },
    { id: 'ten', title: t('ach_ten'), desc: t('ach_ten_d'), event: 'dossier_done', goal: 10, points: 25 },
    { id: 'deep', title: t('ach_deep'), desc: t('ach_deep_d'), event: 'dossier_round', goal: 20, points: 25 },
    { id: 'clean', title: t('ach_clean'), desc: t('ach_clean_d'), event: 'clean_cites', goal: 5, points: 20 },
  ],
})

const sbHandle = ctx.registerStatusItem?.({
  id: 'status', side: 'right', text: t('status_idle', { n: 0 }), title: t('status_tip'),
  onClick: () => { if (ctx.openView) ctx.openView('desk') },
})
let sbCount = 0
function syncStatus() {
  if (!sbHandle || !sbHandle.update) return
  try {
    sbHandle.update(run.running
      ? { text: t('status_run', { pct: Math.round(run.pct) }), title: t('status_tip') }
      : { text: t('status_idle', { n: sbCount }), title: t('status_tip') })
  } catch { /* ignore */ }
}
// 状态栏项是**数据驱动**的(handle.update),和命令面板那种单字符串贡献点不同 —— 它跟得上语言切换,
// 所以挂进语言重渲表。(命令/斜杠/设置标题跟不上是宿主侧已知缺口,README 有写。)
rerenders.add(syncStatus)
const offStatusBus = bus.on((e) => {
  if (!e) return
  if (e.type === 'run') { syncStatus(); return }
  if (e.type === 'index') {
    readIndex().then((idx) => { sbCount = idx.items.length; syncStatus() }).catch(() => {})
  }
})
readIndex().then((idx) => { sbCount = idx.items.length; syncStatus() }).catch(() => {})

// ── check.mjs 测试钩子 ──────────────────────────────────────────────────────
if (globalThis.__DOSSIER_TEST__) {
  Object.assign(globalThis.__DOSSIER_TEST__, {
    verdictOf, normalizeUrl, parseProbeJson, parseDossier, serializeDossier, sectionKeyOf,
    reconcileClaimIds, mergeSources, diffVersions, bodyDigest, healthSummary, slugifyTopic,
    uniqueSlug, parseAgentOutput, extractUrls, renderMarkdown, inline, safeHref, fmtDate,
    stageOf, STEPS, MSG, t,
    // 非 SPEC 必测但 check 要用到的内部件
    applyRound, applyProbes, trimUrlTail, newModel, readIndex, upsertIndex, persistModel, dayKeyOf, padVersion,
    parseClaimMeta, sanitizeFileName, hostOf, onColorOf, readableOn, contrast, wfRoot,
    buildResearchMessage, buildProbeMessage, probeReportMarkdown, run, mountDesk, mountRun, mountDossierFile,
    errText, probeErrText, fire, markCleanCites,
    createDossier, readDossier, checkDossier, probeUrls, enqueueWrite, runResearch,
    cmdCheckNote, saveProbeReport,
  })
}

return () => {
  // 三条 controller 全收:在飞的体检 / 找回档案跑完还会 writeFile 进用户库,
  // 宿主的 revokeSurface 只吊销块表面,readFile/writeFile 照样通。
  for (const c of [run.controller, run.probeController, run.recoverController]) {
    if (c) { try { c.abort() } catch { /* ignore */ } }
  }
  if (sbHandle && sbHandle.dispose) { try { sbHandle.dispose() } catch { /* ignore */ } }
  offStatusBus()
  if (offLocale) { try { offLocale() } catch { /* ignore */ } }
  rerenders.clear()
}
