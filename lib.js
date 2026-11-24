/**
 * Dameng core: bank access, local answer store, interview helpers and export.
 * Only Node built-ins are used so the Host plugin has no install dependencies.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_DATA = path.join(HERE, 'data')
const LANGS = ['zh', 'en', 'ja', 'ko']
const PRIVATE_TAGS = new Set(['private', 'secret', 'shame', 'shadow'])

const UI = {
  zh: {
    progress: '进度',
    core: '主线',
    chars: '字',
    next: '下一题',
    data: '数据',
    skipped: '已跳过',
    none: '没有更多未答题目',
    recorded: '已记录',
    skippedOne: '已跳过',
    exportFiles: '导出文件',
    suggestions: '建议',
    done: '完成',
    hint: '提示',
    ask: '可以追问自己',
  },
  en: {
    progress: 'Progress',
    core: 'Core',
    chars: 'chars',
    next: 'Next',
    data: 'Data',
    skipped: 'skipped',
    none: 'No unanswered questions left',
    recorded: 'Recorded',
    skippedOne: 'Skipped',
    exportFiles: 'Export files',
    suggestions: 'Suggestions',
    done: 'done',
    hint: 'Hint',
    ask: 'Ask yourself',
  },
  ja: {
    progress: '進捗',
    core: 'メイン',
    chars: '字',
    next: '次',
    data: 'データ',
    skipped: 'スキップ',
    none: '未回答の質問はありません',
    recorded: '記録しました',
    skippedOne: 'スキップしました',
    exportFiles: '書き出しファイル',
    suggestions: '提案',
    done: '完了',
    hint: 'ヒント',
    ask: '自分に問い返す',
  },
  ko: {
    progress: '진행',
    core: '메인',
    chars: '자',
    next: '다음',
    data: '데이터',
    skipped: '건너뜀',
    none: '남은 질문이 없습니다',
    recorded: '기록했습니다',
    skippedOne: '건너뛰었습니다',
    exportFiles: '내보낸 파일',
    suggestions: '제안',
    done: '완료',
    hint: '힌트',
    ask: '스스로에게 묻기',
  },
}

export function defaultDataDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'dameng')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function chars(text) {
  return String(text || '').replace(/\s/g, '').length
}

function fmt(template, vars = {}) {
  return String(template).replace(/\{([a-z_]+)\}/g, (all, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : all
  )
}

function safeName(name) {
  const cleaned = String(name || '').trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'me'
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function humanDate() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function quote(text) {
  return String(text || '')
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n')
}

function writeAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
  try { fs.chmodSync(file, 0o600) } catch {}
}

export function createService(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.DAMENG_DATA_DIR || defaultDataDir())
  const dataRoot = path.resolve(options.pluginDataDir || BUNDLED_DATA)
  const storePath = path.join(dataDir, 'answers.json')

  let bankCache = null
  const exportCache = new Map()

  const bank = () => {
    if (!bankCache) bankCache = readJson(path.join(dataRoot, 'bank.json'))
    return bankCache
  }

  const languages = () => bank().languages

  const modules = (lang) => {
    const b = bank()
    return b.modules[lang] || b.modules.zh
  }

  const resolveLang = (lang, store) => {
    if (LANGS.includes(lang)) return lang
    if (store && LANGS.includes(store.lang)) return store.lang
    return 'zh'
  }

  const questionMap = (lang) => {
    const map = new Map()
    for (const m of modules(lang)) {
      for (const q of m.questions) map.set(q.full_id, { ...q, module_id: m.id, module_title: m.title })
    }
    return map
  }

  const allQuestions = (lang) => [...questionMap(lang).values()]

  const loadStore = () => {
    if (!fs.existsSync(storePath)) {
      return { version: 1, lang: 'zh', name: '', answers: {}, skipped: {}, updated_at: null }
    }
    const raw = readJson(storePath)
    return {
      version: 1,
      lang: LANGS.includes(raw.lang) ? raw.lang : 'zh',
      name: typeof raw.name === 'string' ? raw.name : '',
      answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
      skipped: raw.skipped && typeof raw.skipped === 'object' ? raw.skipped : {},
      updated_at: raw.updated_at || null,
    }
  }

  const saveStore = (store) => {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    store.version = 1
    store.updated_at = new Date().toISOString()
    writeAtomic(storePath, JSON.stringify(store, null, 2))
  }

  const answered = (answers, qid) => Boolean(String(answers[qid] || '').trim())

  const loadExport = (lang) => {
    const code = resolveLang(lang, { lang })
    if (exportCache.has(code)) return exportCache.get(code)
    const dir = path.join(dataRoot, 'export', code)
    const pack = {
      code,
      strings: readJson(path.join(dir, 'strings.json')),
      prompt: fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'),
      next: fs.readFileSync(path.join(dir, 'next.md'), 'utf8'),
    }
    exportCache.set(code, pack)
    return pack
  }

  const guide = (lang) => {
    const code = resolveLang(lang, { lang })
    const file = code === 'zh' ? 'guide.md' : 'guide-en.md'
    return { lang: code, text: fs.readFileSync(path.join(dataRoot, file), 'utf8') }
  }

  const coverage = (answers, lang) => {
    const list = []
    for (const m of modules(lang)) {
      const qs = m.questions
      const core = qs.filter((q) => q.core)
      const done = qs.filter((q) => answered(answers, q.full_id))
      const coreDone = core.filter((q) => answered(answers, q.full_id))
      list.push({
        id: m.id,
        title: m.title,
        total: qs.length,
        answered: done.length,
        core_total: core.length,
        core_answered: coreDone.length,
        chars: done.reduce((n, q) => n + chars(answers[q.full_id]), 0),
        private_answered: done.filter((q) => (q.tags || []).some((t) => PRIVATE_TAGS.has(t))).length,
      })
    }
    const total = list.reduce((n, m) => n + m.total, 0)
    const done = list.reduce((n, m) => n + m.answered, 0)
    const coreTotal = list.reduce((n, m) => n + m.core_total, 0)
    const coreDone = list.reduce((n, m) => n + m.core_answered, 0)
    return {
      modules: list,
      total,
      answered: done,
      core_total: coreTotal,
      core_answered: coreDone,
      chars: Object.values(answers).reduce((n, t) => n + chars(t), 0),
      ratio: total ? done / total : 0,
      core_ratio: coreTotal ? coreDone / coreTotal : 0,
    }
  }

  const nextQuestions = ({ lang, module, limit = 3, tier = 'all', includeAnswered = false, store } = {}) => {
    const s = store || loadStore()
    const code = resolveLang(lang, s)
    const list = module ? modules(code).filter((m) => m.id === module) : modules(code)
    if (module && list.length === 0) throw new Error(`unknown module: ${module}`)
    const max = Math.max(1, Math.min(20, Number(limit) || 3))
    const out = []
    for (const m of list) {
      for (const q of m.questions) {
        const isDone = answered(s.answers, q.full_id)
        if (!includeAnswered && (isDone || s.skipped[q.full_id])) continue
        if (tier === 'core' && !q.core) continue
        if (tier === 'deep' && q.core) continue
        out.push({ ...q, module_id: m.id, module_title: m.title })
        if (out.length >= max) return { lang: code, module: module || null, questions: out }
      }
    }
    return { lang: code, module: module || null, questions: out }
  }

  const progressLine = (cov, lang, store) => {
    const u = UI[lang] || UI.en
    return `${u.progress} ${cov.answered}/${cov.total} · ${u.core} ${cov.core_answered}/${cov.core_total} · ${cov.chars.toLocaleString('en-US')} ${u.chars}`
  }

  const status = ({ lang } = {}) => {
    const s = loadStore()
    const code = resolveLang(lang, s)
    const cov = coverage(s.answers, code)
    const nxt = nextQuestions({ lang: code, limit: 3, store: s })
    const u = UI[code] || UI.en
    const nextText = nxt.questions.length
      ? nxt.questions.map((q) => `${q.full_id} ${q.title}`).join(' · ')
      : u.none
    return {
      lang: code,
      answered: cov.answered,
      total: cov.total,
      core_answered: cov.core_answered,
      core_total: cov.core_total,
      chars: cov.chars,
      modules: cov.modules,
      next: nxt.questions.map((q) => q.full_id),
      data_path: storePath,
      text: `${progressLine(cov, code, s)}\n${u.next}: ${nextText}\n${u.data}: ${storePath}`,
    }
  }

  const questions = ({ lang, module, limit = 3, tier = 'all', includeAnswered = false } = {}) => {
    const s = loadStore()
    const code = resolveLang(lang, s)
    const res = nextQuestions({ lang: code, module, limit, tier, includeAnswered, store: s })
    const cov = coverage(s.answers, code)
    const u = UI[code] || UI.en
    const text = res.questions.length
      ? res.questions
          .map((q) => {
            const tags = [q.core ? u.core : null].filter(Boolean).join(' / ')
            const head = `${q.full_id} · ${q.title}${tags ? ` [${tags}]` : ''}`
            const probes = (q.probes || []).map((p) => `- ${p}`).join('\n')
            return `${head}\n${q.prompt}${q.hint ? `\n${u.hint}: ${q.hint}` : ''}${probes ? `\n${u.ask}:\n${probes}` : ''}`
          })
          .join('\n\n')
      : u.none
    return {
      lang: code,
      module: module || null,
      questions: res.questions,
      text: `${progressLine(cov, code, s)}\n\n${text}`,
    }
  }

  const answer = ({ qid, text, skip = false, lang } = {}) => {
    if (!qid || typeof qid !== 'string') throw new Error('qid is required')
    const s = loadStore()
    const code = resolveLang(lang, s)
    const qmap = questionMap(code)
    const q = qmap.get(qid)
    if (!q) throw new Error(`unknown question: ${qid}`)
    if (skip) {
      delete s.answers[qid]
      s.skipped[qid] = true
    } else {
      const value = String(text == null ? '' : text).trim()
      if (!value) throw new Error('text is required unless skip is true')
      s.answers[qid] = value
      delete s.skipped[qid]
    }
    s.lang = code
    if (!s.name) s.name = ''
    saveStore(s)
    const cov = coverage(s.answers, code)
    const nxt = nextQuestions({ lang: code, limit: 2, store: s })
    const u = UI[code] || UI.en
    const nextText = nxt.questions.length
      ? nxt.questions.map((x) => `${x.full_id} ${x.title}`).join(' · ')
      : u.none
    return {
      lang: code,
      qid,
      skipped: Boolean(skip),
      answered: cov.answered,
      total: cov.total,
      core_answered: cov.core_answered,
      core_total: cov.core_total,
      next: nxt.questions.map((x) => x.full_id),
      text: skip
        ? `${u.skippedOne}: ${qid}\n${progressLine(cov, code, s)}\n${u.next}: ${nextText}`
        : `${u.recorded}: ${qid} (${chars(text)} ${u.chars})\n${progressLine(cov, code, s)}\n${u.next}: ${nextText}`,
    }
  }

  const suggestions = (cov, answers, lang, strings) => {
    const tpl = strings.suggestions
    const out = []
    const missing = cov.core_total - cov.core_answered
    if (missing) out.push(fmt(tpl.missingCore, { n: missing }))
    const m13 = cov.modules.find((m) => m.id === 'M13')
    if (m13 && m13.answered < 3) out.push(tpl.languageSamples)
    const weak = cov.modules.filter((m) => m.total && m.answered / m.total < 0.35)
    if (weak.length) {
      out.push(fmt(tpl.weakChapters, {
        names: weak.slice(0, 4).map((m) => `${m.id} ${m.title}`).join(strings.listSeparator),
      }))
    }
    const longCore = allQuestions(lang).filter(
      (q) => q.core && answered(answers, q.full_id) && chars(answers[q.full_id]) < 40
    )
    if (longCore.length > 8) out.push(fmt(tpl.shortAnswers, { n: longCore.length }))
    const hasPrivate = allQuestions(lang).some(
      (q) => answered(answers, q.full_id) && (q.tags || []).some((t) => PRIVATE_TAGS.has(t))
    )
    if (!hasPrivate) out.push(tpl.shadowEmpty)
    if (!out.length) out.push(tpl.allGood)
    return out
  }

  const coverageMarkdown = (answers, name, lang) => {
    const exp = loadExport(lang)
    const c = exp.strings.coverage
    const cov = coverage(answers, exp.code)
    const lines = [
      fmt(c.title, { name }),
      '',
      fmt(c.overall, { answered: cov.answered, total: cov.total, pct: Math.round(cov.ratio * 100) }),
      fmt(c.coreLine, {
        core_answered: cov.core_answered,
        core_total: cov.core_total,
        core_pct: Math.round(cov.core_ratio * 100),
      }),
      fmt(c.charsLine, { chars: cov.chars.toLocaleString('en-US') }),
      fmt(c.privateLine, { n: cov.modules.reduce((n, m) => n + m.private_answered, 0) }),
      '',
      c.byChapter,
      '',
      `| ${c.tableModule} | ${c.tableAnswered} | ${c.tableCore} | ${c.tableChars} | ${c.tableProgress} |`,
      '| --- | --- | --- | --- | --- |',
    ]
    for (const m of cov.modules) {
      const pct = m.total ? Math.round((m.answered / m.total) * 100) : 0
      const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10))
      lines.push(`| ${m.id} ${m.title} | ${m.answered}/${m.total} | ${m.core_answered}/${m.core_total} | ${m.chars.toLocaleString('en-US')} | ${bar} ${pct}% |`)
    }
    lines.push('', c.nextSteps, '')
    for (const s of suggestions(cov, answers, exp.code, exp.strings)) lines.push(`- ${s}`)
    lines.push('')
    return lines.join('\n')
  }

  const dossier = (answers, name, lang) => {
    const exp = loadExport(lang)
    const d = exp.strings.dossier
    const cov = coverage(answers, exp.code)
    const mods = modules(exp.code)
    const lines = [
      fmt(d.title, { name }),
      '',
      fmt(d.meta, {
        date: humanDate(),
        answered: cov.answered,
        total: cov.total,
        core_answered: cov.core_answered,
        core_total: cov.core_total,
        chars: cov.chars.toLocaleString('en-US'),
      }),
      '>',
      d.noteEvidence,
      d.notePrivate,
      '',
      d.coverage,
      '',
      `| ${d.tableModule} | ${d.tableAnswered} | ${d.tableCore} | ${d.tableChars} |`,
      '| --- | --- | --- | --- |',
    ]
    for (const m of cov.modules) {
      lines.push(`| ${m.id} ${m.title} | ${m.answered}/${m.total} | ${m.core_answered}/${m.core_total} | ${m.chars.toLocaleString('en-US')} |`)
    }
    lines.push('', '---', '')
    for (const m of mods) {
      const done = m.questions.filter((q) => answered(answers, q.full_id))
      lines.push(`## ${m.id} ${m.title}`, '', `*${m.subtitle}*`, '')
      if (!done.length) {
        lines.push(d.chapterEmpty, '')
        continue
      }
      for (const q of done) {
        const tags = []
        if (q.core) tags.push(d.core)
        if ((q.tags || []).some((t) => PRIVATE_TAGS.has(t))) tags.push(d.private)
        const label = tags.length ? d.tagPrefix + tags.join(d.tagSeparator) : ''
        lines.push(
          `### ${q.full_id} ${q.title}${label}`,
          '',
          `**${d.question}**${d.labelSeparator}${q.prompt}`,
          '',
          `**${d.answer}**${d.labelSeparator}`,
          '',
          quote(answers[q.full_id]),
          ''
        )
      }
    }
    const gaps = []
    for (const m of mods) {
      const miss = m.questions.filter((q) => !answered(answers, q.full_id))
      if (miss.length) gaps.push({ m, miss })
    }
    if (gaps.length) {
      lines.push('---', '', d.gapsTitle, '')
      for (const { m, miss } of gaps) {
        lines.push(`- **${m.id} ${m.title}**${d.labelSeparator}${miss.map((q) => `${q.id} ${q.title}`).join(exp.strings.listSeparator)}`)
      }
      lines.push('')
      lines.push(...String(d.gapsNote).split(/\r?\n/))
      lines.push('')
    }
    return lines.join('\n')
  }

  const exportAll = ({ name, lang, outDir } = {}) => {
    const s = loadStore()
    const code = resolveLang(lang, s)
    const exp = loadExport(code)
    const finalName = String(name || s.name || (code === 'zh' ? '我' : code === 'ja' ? '私' : code === 'ko' ? '나' : 'Me')).trim() || 'Me'
    const answers = s.answers
    let folder
    if (outDir) {
      const base = path.resolve(dataDir)
      const target = path.resolve(outDir)
      const rel = path.relative(base, target)
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('outDir must stay inside the Dameng data directory')
      }
      folder = target
    } else {
      folder = path.join(dataDir, 'exports', `${stamp()}_${safeName(finalName)}`)
    }
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 })
    const names = exp.strings.files
    const paths = {
      dossier: path.join(folder, names.dossier),
      prompt: path.join(folder, names.prompt),
      coverage: path.join(folder, names.coverage),
      backup: path.join(folder, names.backup),
      next: path.join(folder, names.next),
    }
    const body = dossier(answers, finalName, code)
    writeAtomic(paths.dossier, body)
    writeAtomic(paths.prompt, `${exp.prompt.trimEnd()}\n\n${body}\n`)
    writeAtomic(paths.coverage, coverageMarkdown(answers, finalName, code))
    writeAtomic(paths.backup, JSON.stringify({
      name: finalName,
      lang: code,
      exported_at: new Date().toISOString(),
      answers,
      skipped: s.skipped,
    }, null, 2))
    writeAtomic(paths.next, exp.next)
    const cov = coverage(answers, code)
    const files = ['dossier', 'prompt', 'coverage', 'backup', 'next'].map((kind) => ({
      kind,
      label: exp.strings.labels[kind],
      path: paths[kind],
    }))
    const tips = suggestions(cov, answers, code, exp.strings)
    const u = UI[code] || UI.en
    return {
      dir: folder,
      lang: code,
      coverage: cov,
      suggestions: tips,
      files,
      text: `${u.exportFiles}:\n${files.map((f) => `- ${f.label}: ${f.path}`).join('\n')}\n\n${u.suggestions}:\n${tips.map((x) => `- ${x}`).join('\n')}`,
    }
  }

  return {
    dataDir,
    storePath,
    languages,
    modules,
    loadStore,
    status,
    questions,
    answer,
    guide,
    coverage,
    suggestions,
    dossier,
    coverageMarkdown,
    exportAll,
    loadExport,
  }
}
