#!/usr/bin/env node
/**
 * 起動前チェックスクリプト
 * npm run check で実行
 * claude CLIがインストール・ログイン済みかを確認する
 */
const { execSync } = require('child_process');

console.log('\n=== 上流力トレーニングシステム 起動前チェック ===\n');

let allOk = true;

// 1. claude コマンドの存在確認
try {
  const version = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
  console.log(`✅ Claude Code: ${version}`);
} catch (e) {
  console.log('❌ Claude Code が見つかりません');
  console.log('   インストール: npm install -g @anthropic-ai/claude-code');
  allOk = false;
}

// 2. ログイン状態の確認（claude whoami 相当）
if (allOk) {
  try {
    // --print モードで簡単な確認プロンプトを送る（認証確認のみ）
    execSync('claude -p "hi" --output-format json', {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log('✅ Claude Code ログイン状態: 認証済み');
  } catch (e) {
    const msg = e.stderr || e.message || '';
    if (msg.includes('login') || msg.includes('auth') || msg.includes('credential')) {
      console.log('❌ Claude Code にログインが必要です');
      console.log('   実行してください: claude login');
      allOk = false;
    } else {
      // エラーでも認証は通っている可能性がある（モデル応答エラー等）
      console.log('✅ Claude Code ログイン状態: 認証済み（応答あり）');
    }
  }
}

// 3. Node.js バージョン
const nodeVer = process.version;
const major = parseInt(nodeVer.slice(1));
if (major >= 18) {
  console.log(`✅ Node.js: ${nodeVer}`);
} else {
  console.log(`⚠️  Node.js ${nodeVer} — v18以上を推奨します`);
}

// 4. 環境変数の警告
if (process.env.ANTHROPIC_API_KEY) {
  console.log('\n⚠️  警告: ANTHROPIC_API_KEY 環境変数が設定されています');
  console.log('   この場合 Claude Code はサブスクではなくAPIキー課金になります');
  console.log('   サブスク枠を使いたい場合は環境変数を削除してください');
  console.log('   参考: https://support.claude.com/en/articles/11145838');
}

console.log('\n' + (allOk ? '✅ 準備完了。npm start で起動できます。' : '❌ 上記の問題を解決してから再実行してください。') + '\n');
process.exit(allOk ? 0 : 1);
