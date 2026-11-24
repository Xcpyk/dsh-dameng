/**
 * Host half of the Dameng plugin: five model-facing tools over the local survey store.
 * No dependencies beyond Node built-ins are imported, so a linked local bundle activates
 * without installing anything into the profile.
 */
import { createService } from './lib.js'

export const name = 'dameng'
export const inject = ['tools']

const LANG = {
  type: 'string',
  enum: ['zh', 'en', 'ja', 'ko'],
  description: '语言 / language: zh (中文), en, ja, ko. Defaults to the last language used.',
}

const TEXT_OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: true,
    properties: { text: { type: 'string' } },
  },
  render(_args, value) {
    return [{ type: 'text', text: String(value && value.text ? value.text : '') }]
  },
}

function toolStatus(svc) {
  return {
    name: 'dameng_status',
    description:
      'Show Dameng life-survey progress: answered/core counts, per-chapter coverage, next unanswered question ids, and the local data path. Call before starting or resuming an interview.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { lang: LANG },
    },
    output: TEXT_OUTPUT,
    presentCall: () => ({ card: 'generic', title: 'Dameng progress', kind: 'read' }),
    async execute(args) {
      return svc.status({ lang: args && args.lang })
    },
  }
}

function toolGuide(svc) {
  return {
    name: 'dameng_guide',
    description:
      'Read the Dameng interview protocol before the first interview: session plan, concrete follow-up technique, how to record verbatim answers, and safety boundaries. Call this when the person says they want to start or continue the life survey.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { lang: LANG },
    },
    output: TEXT_OUTPUT,
    presentCall: () => ({ card: 'generic', title: 'Dameng interview guide', kind: 'read' }),
    async execute(args) {
      return svc.guide(args && args.lang)
    },
  }
}

function toolQuestions(svc) {
  return {
    name: 'dameng_questions',
    description:
      'Fetch the next unanswered Dameng questions, with prompt, hint and self-probes. Ask one question at a time, in the person\'s language; then record the answer verbatim with dameng_answer. Use `tier` to prefer core, deep, or all questions.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        module: { type: 'string', description: 'Optional chapter id, M01 through M14. Omit for the next questions across the whole survey.' },
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'How many questions to return; default 3.' },
        tier: { type: 'string', enum: ['core', 'deep', 'all'], description: 'core = main line, deep = non-core, all = both. Default all.' },
        includeAnswered: { type: 'boolean', description: 'Include already answered or skipped questions. Default false.' },
        lang: LANG,
      },
    },
    output: TEXT_OUTPUT,
    presentCall: () => ({ card: 'generic', title: 'Dameng questions', kind: 'read' }),
    async execute(args) {
      const a = args || {}
      return svc.questions({
        lang: a.lang,
        module: a.module,
        limit: a.limit == null ? 3 : a.limit,
        tier: a.tier || 'all',
        includeAnswered: Boolean(a.includeAnswered),
      })
    },
  }
}

function toolAnswer(svc) {
  return {
    name: 'dameng_answer',
    description:
      'Record one Dameng answer. Prefer the person\'s exact words; do not paraphrase or fill gaps. Set skip:true when they do not want to answer. Returns updated progress and the next question ids.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['qid'],
      properties: {
        qid: { type: 'string', description: 'Question id exactly as returned, for example M03.Q02.' },
        text: { type: 'string', description: 'The answer, verbatim where possible. Required unless skip is true.' },
        skip: { type: 'boolean', description: 'Mark this question skipped instead of answering. Default false.' },
        lang: LANG,
      },
    },
    output: TEXT_OUTPUT,
    presentCall: () => ({ card: 'generic', title: 'Record Dameng answer', kind: 'edit' }),
    async execute(args) {
      const a = args || {}
      return svc.answer({ qid: a.qid, text: a.text, skip: Boolean(a.skip), lang: a.lang })
    },
  }
}

function toolExport(svc) {
  return {
    name: 'dameng_export',
    description:
      'Write a complete Dameng export in the selected language: life archive, distillation brief, coverage report, answer backup and next steps. The brief already asks a model to produce persona.md in that language. Answers remain verbatim; only templates are translated.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Name shown on the archive. Defaults to the stored name, then a localized “me”.' },
        lang: LANG,
        outDir: { type: 'string', description: 'Optional subdirectory under the Dameng data directory. Defaults to <data dir>/exports/<timestamp>_<name>.' },
      },
    },
    output: TEXT_OUTPUT,
    presentCall: () => ({ card: 'generic', title: 'Export Dameng archive', kind: 'execute' }),
    async execute(args) {
      const a = args || {}
      return svc.exportAll({ name: a.name, lang: a.lang, outDir: a.outDir })
    },
  }
}

export function apply(ctx) {
  const svc = createService()
  const definitions = [
    toolStatus(svc),
    toolGuide(svc),
    toolQuestions(svc),
    toolAnswer(svc),
    toolExport(svc),
  ]
  ctx.effect(() => {
    const disposers = definitions.map((definition) => ctx.tools.register(definition))
    return () => {
      for (const dispose of disposers) dispose()
    }
  })
}
