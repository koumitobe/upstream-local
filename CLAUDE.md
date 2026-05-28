# 上流力トレーニングシステム v2 — Claude Code 作業指示

## このプロジェクトの概要
Claude Codeサブスク認証版。APIキー不要で動作します。
`claude -p` コマンドを子プロセスとして呼び出してAI応答を得ます。

## ファイル構成
```
upstream-trainer-local-v2/
├── CLAUDE.md              ← この作業指示
├── server.js              ← Expressサーバー（APIキー不要版）
├── claude-client.js       ← claude CLIを子プロセスで呼ぶモジュール
├── check-claude.js        ← 起動前チェックスクリプト
├── package.json           ← 依存関係（@anthropic-ai/sdk は不要）
├── .env.example           ← PORT等のみ（APIキーは設定しない）
├── public/index.html      ← フロントエンド
├── scenarios/             ← 顧客シナリオJSON
├── rubrics/               ← AI採点ルーブリック
├── prompts/               ← シナリオ作成テンプレート
└── data/                  ← 実行時生成（gitignore推奨）
    ├── sessions/          ← セッション中データ
    └── results/           ← 採点結果 ★HTMLレポートはここ★
```

## 認証の仕組み
- `claude-client.js` が `spawn('claude', ['--print', prompt, '--output-format', 'json'])` を実行
- Claude Codeのログインセッションが自動で使われる
- `ANTHROPIC_API_KEY` 環境変数が**未設定**の場合のみサブスク枠を使用
- 設定されている場合はAPI課金になるので注意

## セットアップ
```bash
npm install
npm run check   # 動作確認
npm start       # http://localhost:3000
```

## 主要APIエンドポイント
| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/health | Claude Code接続確認 |
| GET | /api/scenarios | シナリオ一覧 |
| POST | /api/session/start | セッション開始 |
| POST | /api/session/:id/message | メッセージ送信 |
| POST | /api/session/:id/finish | 試験終了+AI採点 |
| GET | /api/results | 結果一覧 |
| GET | /results/:file | HTMLレポート配信 |

## 注意事項
- claude -p の実行に3〜10秒かかります（正常）
- data/ は .gitignore に追加（個人情報含む）
- 同時に複数セッションを動かすと上限に早く到達する
