/**
 * server.js — 上流力トレーニングシステム v2
 * Claude Codeサブスク認証版（APIキー不要）
 *
 * 動作条件:
 *   1. claude コマンドがインストールされていること
 *   2. claude login でログイン済みであること
 *   3. ANTHROPIC_API_KEY 環境変数が未設定であること
 */

require('dotenv').config({ path: '.env' });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { callClaude } = require('./claude-client');

const app = express();
const PORT = process.env.PORT || 3000;
const RESULTS_DIR = process.env.RESULTS_DIR || './data/results';
const SESSIONS_DIR = './data/sessions';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

[RESULTS_DIR, SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (process.env.ANTHROPIC_API_KEY) {
  console.warn('\n⚠️  ANTHROPIC_API_KEY が設定されています。サブスク枠ではなくAPI課金になります。');
  console.warn('   サブスク枠を使う場合: unset ANTHROPIC_API_KEY\n');
}

function loadScenarios() {
  const dir = './scenarios';
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

// ヘルスチェック
app.get('/api/health', async (req, res) => {
  try {
    const reply = await callClaude('「OK」とだけ答えてください。', { timeout: 20000 });
    res.json({ status: 'ok', message: reply });
  } catch (e) {
    res.status(503).json({ status: 'error', message: e.message });
  }
});

// シナリオ一覧
app.get('/api/scenarios', (req, res) => {
  try {
    const scenarios = loadScenarios().map(s => ({
      id: s.id, metadata: s.metadata, customer: s.customer,
      opening_message: s.opening_message, hint_questions: s.hint_questions,
      eval_criteria: s.eval_criteria,
    }));
    res.json({ scenarios });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// セッション開始
app.post('/api/session/start', (req, res) => {
  const { scenario_id, examinee_name } = req.body;
  const session_id = uuidv4();
  const scenario = loadScenarios().find(s => s.id === scenario_id);
  if (!scenario) return res.status(404).json({ error: 'シナリオが見つかりません' });
  const session = {
    session_id, scenario_id,
    examinee_name: examinee_name || '受験者',
    started_at: new Date().toISOString(),
    messages: [], status: 'active',
  };
  fs.writeFileSync(path.join(SESSIONS_DIR, `${session_id}.json`), JSON.stringify(session, null, 2));
  res.json({ session_id, scenario: { id: scenario.id, metadata: scenario.metadata, customer: scenario.customer } });
});

// メッセージ送信 → 顧客AI応答
app.post('/api/session/:session_id/message', async (req, res) => {
  const { session_id } = req.params;
  const { text } = req.body;
  const sessionPath = path.join(SESSIONS_DIR, `${session_id}.json`);
  if (!fs.existsSync(sessionPath)) return res.status(404).json({ error: 'セッションが見つかりません' });
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  if (session.status !== 'active') return res.status(400).json({ error: 'セッションは終了しています' });
  const scenario = loadScenarios().find(s => s.id === session.scenario_id);

  session.messages.push({ role: 'user', content: text, timestamp: new Date().toISOString() });

  try {
    const historyText = session.messages.slice(0, -1)
      .map(m => (m.role === 'user' ? 'エンジニア: ' : `${scenario.customer.name}: `) + m.content)
      .join('\n');

    const fullPrompt = `${scenario.system_prompt}

---

これまでの会話:
${historyText || '（会話開始）'}

エンジニア: ${text}

上記に対して、あなたのキャラクターとして自然に返答してください。返答のみを出力してください。`;

    const reply = await callClaude(fullPrompt, { timeout: 60000 });
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    res.json({ reply, turn_count: session.messages.length });
  } catch (e) {
    console.error('顧客AI応答エラー:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// セッション終了 + AI採点
app.post('/api/session/:session_id/finish', async (req, res) => {
  const { session_id } = req.params;
  const sessionPath = path.join(SESSIONS_DIR, `${session_id}.json`);
  if (!fs.existsSync(sessionPath)) return res.status(404).json({ error: 'セッションが見つかりません' });
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  session.status = 'finished';
  session.finished_at = new Date().toISOString();
  const scenario = loadScenarios().find(s => s.id === session.scenario_id);

  const conversationLog = session.messages
    .map(m => (m.role === 'user' ? 'エンジニア' : scenario.customer.name) + ': ' + m.content)
    .join('\n\n');

  const rubric = fs.readFileSync('./rubrics/upstream_eval_rubric.md', 'utf-8');

  const evalPrompt = `${rubric}

## 採点対象
シナリオ: ${scenario.metadata.title}
顧客の本質課題: ${scenario.hidden_context.real_problem}
評価基準:
- 課題特定: ${scenario.eval_criteria.issue_identification}
- 要件品質: ${scenario.eval_criteria.requirements_quality}
- 橋渡し力: ${scenario.eval_criteria.ai_bridge}
- スタンス: ${scenario.eval_criteria.stance}

## 会話ログ
${conversationLog}

## 出力指示
以下のJSONのみを返してください。前置き・説明・コードブロック記号は不要です。

{"scores":{"issue_identification":0,"requirements_quality":0,"ai_bridge":0,"stance":0},"total":0,"pass":false,"cutoff_failed":[],"feedback":{"issue_identification":"","requirements_quality":"","ai_bridge":"","stance":""},"improvement":""}`;

  try {
    const rawReply = await callClaude(evalPrompt, { timeout: 90000 });
    let evalResult;
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      evalResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (_) { evalResult = null; }

    if (!evalResult) {
      evalResult = {
        scores: { issue_identification: 0, requirements_quality: 0, ai_bridge: 0, stance: 0 },
        total: 0, pass: false, cutoff_failed: [],
        feedback: { issue_identification: '採点結果の解析に失敗しました', requirements_quality: '', ai_bridge: '', stance: '' },
        improvement: '再度試験を実施してください',
      };
    }

    const resultRecord = {
      session_id, examinee_name: session.examinee_name,
      scenario_id: scenario.id, scenario_title: scenario.metadata.title,
      difficulty: scenario.metadata.difficulty,
      started_at: session.started_at, finished_at: session.finished_at,
      duration_minutes: Math.round((new Date(session.finished_at) - new Date(session.started_at)) / 60000),
      turn_count: Math.floor(session.messages.length / 2),
      eval: evalResult, conversation_log: session.messages,
    };

    const resultPath = path.join(RESULTS_DIR, `${session_id}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(resultRecord, null, 2));
    const htmlPath = path.join(RESULTS_DIR, `${session_id}.html`);
    fs.writeFileSync(htmlPath, generateHtmlReport(resultRecord, scenario));
    session.eval = evalResult;
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

    res.json({ eval: evalResult, result_files: { json: resultPath, html: htmlPath } });
  } catch (e) {
    console.error('AI採点エラー:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 結果・セッションデータ全削除（進行中セッションは除外）
app.delete('/api/results', (req, res) => {
  const sessionFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));

  const activeSessions = new Set();
  sessionFiles.forEach(f => {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
      if (s.status === 'active') activeSessions.add(s.session_id);
    } catch (_) {}
  });

  let deleted = 0;
  sessionFiles.forEach(f => {
    const id = f.replace('.json', '');
    if (!activeSessions.has(id)) {
      fs.unlinkSync(path.join(SESSIONS_DIR, f));
      deleted++;
    }
  });

  fs.readdirSync(RESULTS_DIR).forEach(f => {
    const id = f.replace(/\.(json|html)$/, '');
    if (!activeSessions.has(id)) {
      fs.unlinkSync(path.join(RESULTS_DIR, f));
      deleted++;
    }
  });

  res.json({ deleted, active_sessions_kept: activeSessions.size });
});

// セッション取得（画面復元用）
app.get('/api/session/:session_id', (req, res) => {
  const p = path.join(SESSIONS_DIR, `${req.params.session_id}.json`);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'セッションが見つかりません' });
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

// 結果一覧
app.get('/api/results', (req, res) => {
  try {
    const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
    const results = files.map(f => {
      const r = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8'));
      return {
        session_id: r.session_id, examinee_name: r.examinee_name,
        scenario_title: r.scenario_title, difficulty: r.difficulty,
        started_at: r.started_at, duration_minutes: r.duration_minutes,
        turn_count: r.turn_count, total_score: r.eval?.total ?? null, pass: r.eval?.pass ?? null,
      };
    }).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 結果詳細
app.get('/api/results/:session_id', (req, res) => {
  const p = path.join(RESULTS_DIR, `${req.params.session_id}.json`);
  if (!fs.existsSync(p)) return res.status(404).json({ error: '結果が見つかりません' });
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

// HTMLレポート配信
app.get('/results/:file', (req, res) => {
  const p = path.join(RESULTS_DIR, req.params.file);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(path.resolve(p));
});

// HTMLレポート生成
function generateHtmlReport(record, scenario) {
  const e = record.eval;
  const scores = e.scores || {};
  const total = e.total || 0;
  const passColor = e.pass ? '#1a7a4a' : '#c43a1a';
  const passBg = e.pass ? '#edf7f2' : '#fef0ee';
  const axes = [
    { key: 'issue_identification', label: '課題特定力', max: 30 },
    { key: 'requirements_quality', label: '要件定義品質', max: 30 },
    { key: 'ai_bridge', label: 'AIへの橋渡し力', max: 25 },
    { key: 'stance', label: 'スタンス発揮', max: 15 },
  ];
  const axisRows = axes.map(a => {
    const score = scores[a.key] || 0;
    const pct = Math.round((score / a.max) * 100);
    const color = pct >= 70 ? '#1a7a4a' : pct >= 40 ? '#c47a1a' : '#c43a1a';
    return `<tr>
      <td style="padding:10px 8px;font-weight:500">${a.label}</td>
      <td style="padding:10px 8px;text-align:center;font-family:monospace;font-weight:700;color:${color}">${score}/${a.max}</td>
      <td style="padding:10px 8px;width:160px"><div style="background:#f0ede8;border-radius:4px;height:8px;overflow:hidden"><div style="width:${pct}%;background:${color};height:100%;border-radius:4px"></div></div></td>
      <td style="padding:10px 8px;font-size:13px;color:#6b6760">${esc(e.feedback?.[a.key] || '')}</td>
    </tr>`;
  }).join('');
  const convHtml = record.conversation_log.map(m => {
    const isUser = m.role === 'user';
    const align = isUser ? 'flex-end' : 'flex-start';
    const bg = isUser ? '#eef2fd' : '#fef3ee';
    const border = isUser ? '#bdd0f9' : '#f5c4b0';
    const color = isUser ? '#0d1e5c' : '#3d1a0a';
    return `<div style="display:flex;flex-direction:column;align-items:${align};margin-bottom:12px">
      <div style="font-size:11px;color:#9c9890;margin-bottom:3px;font-family:monospace">${esc(isUser ? record.examinee_name : scenario.customer.name)}</div>
      <div style="max-width:75%;background:${bg};border:0.5px solid ${border};border-radius:10px;padding:10px 14px;font-size:13.5px;line-height:1.65;color:${color};white-space:pre-wrap">${esc(m.content)}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>評価レポート — ${esc(record.examinee_name)}</title>
<style>body{font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;background:#f7f6f2;color:#1a1916;margin:0;padding:24px;line-height:1.6}.container{max-width:860px;margin:0 auto}.card{background:#fff;border:0.5px solid #e2ddd6;border-radius:12px;padding:24px;margin-bottom:20px}h2{font-size:15px;font-weight:700;margin:0 0 16px;padding-bottom:8px;border-bottom:0.5px solid #e2ddd6}table{width:100%;border-collapse:collapse}tr{border-bottom:0.5px solid #f0ede8}tr:last-child{border-bottom:none}@media print{body{padding:0}.card{break-inside:avoid}}</style>
</head><body><div class="container">
  <div class="card"><h1 style="font-size:20px;font-weight:700;margin:0 0 4px">上流力試験 評価レポート</h1><p style="color:#6b6760;font-size:13px;margin:4px 0 0">生成: ${new Date().toLocaleString('ja-JP')} ／ Claude Codeサブスク認証版</p></div>
  <div class="card"><h2>受験情報</h2><table>
    <tr><td style="padding:8px 0;color:#6b6760;width:140px">受験者</td><td style="padding:8px 0;font-weight:500">${esc(record.examinee_name)}</td></tr>
    <tr><td style="padding:8px 0;color:#6b6760">シナリオ</td><td style="padding:8px 0">${esc(record.scenario_title)}</td></tr>
    <tr><td style="padding:8px 0;color:#6b6760">難易度</td><td style="padding:8px 0">${{easy:'易',medium:'中',hard:'難'}[record.difficulty]||record.difficulty}</td></tr>
    <tr><td style="padding:8px 0;color:#6b6760">受験日時</td><td style="padding:8px 0">${new Date(record.started_at).toLocaleString('ja-JP')}</td></tr>
    <tr><td style="padding:8px 0;color:#6b6760">所要時間</td><td style="padding:8px 0">${record.duration_minutes}分</td></tr>
    <tr><td style="padding:8px 0;color:#6b6760">ターン数</td><td style="padding:8px 0">${record.turn_count}往復</td></tr>
  </table></div>
  <div class="card"><h2>総合結果</h2>
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px">
      <div style="font-size:52px;font-weight:700;font-family:monospace;color:${passColor}">${total}<span style="font-size:20px;color:#9c9890">/100</span></div>
      <div><div style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:15px;font-weight:700;background:${passBg};color:${passColor};margin-bottom:6px">${e.pass ? '合格' : '不合格'}</div>
      ${e.cutoff_failed?.length > 0 ? `<div style="font-size:12px;color:#c43a1a">足切り: ${e.cutoff_failed.join(', ')}</div>` : ''}</div>
    </div>
    <div style="background:#f7f6f2;border-radius:8px;padding:14px;font-size:14px;color:#3d1a0a;line-height:1.7"><strong>改善提案:</strong> ${esc(e.improvement||'')}</div>
  </div>
  <div class="card"><h2>評価軸別スコア</h2><table>
    <thead><tr style="font-size:12px;color:#9c9890"><th style="text-align:left;padding:6px 8px;font-weight:500">評価軸</th><th style="padding:6px 8px;font-weight:500">スコア</th><th style="padding:6px 8px;font-weight:500">達成率</th><th style="text-align:left;padding:6px 8px;font-weight:500">コメント</th></tr></thead>
    <tbody>${axisRows}</tbody>
  </table></div>
  <div class="card"><h2>会話ログ</h2><div style="max-height:600px;overflow-y:auto;padding:4px">${convHtml}</div></div>
</div></body></html>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

app.listen(PORT, () => {
  console.log('\n✅ 上流力トレーニングシステム v2（Claude Codeサブスク認証版）');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   採点結果: ${path.resolve(RESULTS_DIR)}`);
  console.log('   起動前確認: npm run check\n');
});
