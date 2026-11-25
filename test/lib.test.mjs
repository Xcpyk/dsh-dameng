import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createService } from '../lib.js'

const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dameng-test-'))

test('public export omits private answer and private backup entry', () => {
  const root = fresh()
  const svc = createService({ dataDir: root })
  svc.answer({ qid: 'M01.Q01', text: 'public answer', lang: 'en' })
  svc.answer({ qid: 'M08.Q04', text: 'SECRET-PRIVATE-TEXT', lang: 'en' })
  const result = svc.exportAll({ name: 'Test', lang: 'en' })
  const dossier = fs.readFileSync(result.files.find((f) => f.kind === 'dossier').path, 'utf8')
  const backup = JSON.parse(fs.readFileSync(result.files.find((f) => f.kind === 'backup').path, 'utf8'))
  assert.equal(dossier.includes('SECRET-PRIVATE-TEXT'), false)
  assert.equal(dossier.includes('[Private layer, omitted]'), true)
  assert.equal(backup.answers['M08.Q04'], undefined)
  assert.equal(backup.private_included, false)
})

test('includePrivate writes the raw text and a warning', () => {
  const root = fresh()
  const svc = createService({ dataDir: root })
  svc.answer({ qid: 'M08.Q04', text: 'SECRET-PRIVATE-TEXT', lang: 'en' })
  const result = svc.exportAll({ name: 'Test', lang: 'en', includePrivate: true })
  const dossier = fs.readFileSync(result.files.find((f) => f.kind === 'dossier').path, 'utf8')
  assert.equal(dossier.includes('SECRET-PRIVATE-TEXT'), true)
  assert.equal(dossier.includes('This export contains private-layer text'), true)
})

test('import merges missing answers only', () => {
  const source = fresh()
  const sourceSvc = createService({ dataDir: source })
  sourceSvc.answer({ qid: 'M01.Q01', text: 'first', lang: 'en' })
  sourceSvc.answer({ qid: 'M01.Q02', text: 'second', lang: 'en' })
  const exported = sourceSvc.exportAll({ name: 'Source', lang: 'en' })
  const backupPath = exported.files.find((f) => f.kind === 'backup').path

  const target = fresh()
  const targetSvc = createService({ dataDir: target })
  targetSvc.answer({ qid: 'M01.Q01', text: 'keep me', lang: 'en' })
  const result = targetSvc.importAnswers({ file: backupPath })
  assert.equal(result.imported, 1)
  assert.equal(result.skipped_existing, 1)
  assert.equal(targetSvc.loadStore().answers['M01.Q01'], 'keep me')
  assert.equal(targetSvc.loadStore().answers['M01.Q02'], 'second')
})
