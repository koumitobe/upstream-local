/**
 * claude-client.js
 * claude CLI を子プロセスとして呼び出すモジュール
 * APIキー不要 — ログイン済みのClaude Codeサブスク認証を使用
 */
const { spawn } = require('child_process');

/**
 * claude -p "プロンプト" --output-format json を実行してテキストを返す
 * @param {string} prompt  送信するプロンプト全文
 * @param {object} opts    オプション { timeout: ms }
 * @returns {Promise<string>} Claudeの応答テキスト
 */
function callClaude(prompt, opts = {}) {
  const timeout = opts.timeout || 60000; // デフォルト60秒

  return new Promise((resolve, reject) => {
    // --print (-p) モード: 対話なしで1回だけ応答して終了
    // --output-format json: 結果をJSONで受け取る
    const args = [
      '--print', prompt,
      '--output-format', 'json',
    ];

    const proc = spawn('claude', args, {
      env: {
        ...process.env,
        // ANTHROPIC_API_KEY が設定されていても無視させる手段はないが、
        // 未設定の場合はサブスク認証が自動で使われる
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`タイムアウト (${timeout}ms) — claude コマンドが応答しませんでした`));
    }, timeout);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        return reject(new Error(`claude 終了コード ${code}: ${stderr.slice(0, 300)}`));
      }
      // --output-format json の出力をパース
      // 形式: { "type": "result", "result": "応答テキスト", ... }
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        // 最後のJSONオブジェクトを取得
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const obj = JSON.parse(lines[i]);
            if (obj.result) return resolve(obj.result.trim());
            if (obj.type === 'result' && obj.result !== undefined) return resolve(obj.result.trim());
          } catch (_) { continue; }
        }
        // JSONパース失敗時はstdout生テキストを返す
        resolve(stdout.trim());
      } catch (e) {
        resolve(stdout.trim());
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(
          'claude コマンドが見つかりません。\n' +
          'インストール: npm install -g @anthropic-ai/claude-code\n' +
          'ログイン:     claude login'
        ));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { callClaude };
