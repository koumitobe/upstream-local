# 上流力トレーニングシステム

架空の顧客AIとヒアリングを行い、課題特定・要件定義・AIへの橋渡し力を鍛えるトレーニングツールです。
試験終了後にAIが自動採点し、フィードバックレポートを生成します。

> **APIキー不要。** 自分のClaude Codeサブスクリプション枠を使用します。

※上流版ときめきメモリアル
---

## 動作に必要なもの

| 必要なもの | 条件 |
|---|---|
| Claude のサブスクリプション | **Pro プラン以上**（Max 推奨） |
| Node.js | **v18 以上** |
| Claude Code CLI | インストール・ログイン済みであること |

---

## セットアップ手順

### 1. Node.js のインストール

[https://nodejs.org/](https://nodejs.org/) から **LTS版** をダウンロードしてインストールしてください。

インストール確認：
```bash
node -v   # v18.0.0 以上が表示されればOK
```

### 2. Claude Code CLI のインストール・ログイン

```bash
# CLIをインストール
npm install -g @anthropic-ai/claude-code

# Claudeアカウントでログイン（Pro プラン以上が必要）
claude login
```

ブラウザが開くのでサインインしてください。

### 3. リポジトリのクローン

```bash
git clone https://github.com/koumitobe/upstream-local.git
cd upstream-local
```

### 4. 依存パッケージのインストール

```bash
npm install
```

### 5. 動作確認（推奨）

```bash
npm run check
```

`✅ OK` が表示されれば準備完了です。

### 6. 起動

```bash
npm start
```

ブラウザで **http://localhost:3000** を開いてください。

---

## ⚠️ 重要：ANTHROPIC_API_KEY の確認

`ANTHROPIC_API_KEY` という環境変数が設定されていると、サブスク枠ではなく **API課金** になります。

起動前に以下で確認してください：

```bash
echo $ANTHROPIC_API_KEY
```

値が表示された場合は、以下のコマンドで一時的に無効化してから起動してください：

```bash
unset ANTHROPIC_API_KEY
npm start
```

---

## 誰のサブスク枠を使うか

このサーバーを起動したPCの **Claudeログインアカウント** の枠を消費します。

| 運用パターン | 誰の枠を使うか |
|---|---|
| 受験者が自分のPCで `npm start` | 受験者自身の枠 |
| 管理者PCでサーバーを立てて複数人がブラウザでアクセス | 管理者の枠（同時受験は注意）|

**推奨：** 各受験者が自分のPCで起動する（枠を分散できる）

---

## 画面の使い方

### 試験を受ける
1. 受験者名を入力
2. シナリオを選択してクリック
3. 「試験を開始する」ボタンを押す
4. 顧客AIとチャット形式でヒアリングを実施
5. 「試験を終了して採点」ボタンで採点

### チャット中の操作
- **メッセージ送信：** ↑ ボタンのみ（Enterキーは改行）
- **ヒントチップ：** よく使う質問文をクリックで入力欄に挿入
- **メモ：** サイドバーのメモ欄に確認事項・仮説を自由に記録できます

### セッションの復元
試験中にブラウザを閉じたり別タブに移動しても、再度 http://localhost:3000 を開けば続きから再開できます。ナビバーの **「◉ 試験進行中」** タブから戻れます。

---

## シナリオ一覧

| シナリオ | 顧客 | 難易度 | 所要時間 |
|---|---|---|---|
| 物流会社の業務システム刷新 | 田中 誠（管理部長）| 中 | 約30分 |
| 教育サービスのデジタル化 | 山田 彩（事業部長）| 難 | 約40分 |
| 飲食店の予約管理システム | 鈴木 健太（オーナー）| 易 | 約25分 |

---

## シナリオを追加する

`scenarios/` ディレクトリに JSON ファイルを置くだけで、サーバーコードの変更なしに追加できます。

### 手順

**1. ファイルを作成する**

ファイル名は `scenario_04_xxxxx.json` のように連番形式にしてください（ファイル名の昇順で一覧に表示されます）。

```bash
touch scenarios/scenario_04_retail.json
```

**2. JSON の内容を記述する**

以下のテンプレートをコピーして編集してください。

```json
{
  "id": "scenario_04",
  "metadata": {
    "label": "SCENARIO 04",
    "title": "シナリオのタイトル",
    "difficulty": "easy",
    "estimated_time_minutes": 30,
    "target_rank": "US認定"
  },
  "customer": {
    "name": "顧客氏名",
    "company": "会社名",
    "role": "役職",
    "age_range": "40代",
    "initials": "顧"
  },
  "persona": {
    "personality": ["性格の特徴1", "性格の特徴2"],
    "todays_situation": "今日の状況説明"
  },
  "hidden_context": {
    "real_problem": "顧客の本質課題（受験者には見えない）",
    "budget": "予算感",
    "constraints": ["制約1", "制約2"],
    "blocker": "意思決定のブロッカー"
  },
  "opening_message": "最初に顧客AIが送るメッセージ",
  "hint_questions": ["ヒント質問1", "ヒント質問2"],
  "eval_criteria": {
    "issue_identification": "採点観点①：課題特定",
    "requirements_quality": "採点観点②：要件品質",
    "ai_bridge": "採点観点③：橋渡し力",
    "stance": "採点観点④：スタンス"
  },
  "system_prompt": "あなたは「顧客氏名」を演じてください。（以下、ペルソナ設定）"
}
```

**3. サーバーを再起動する**

```bash
# Ctrl+C で停止してから
npm start
```

再起動後、シナリオ選択画面に自動で追加されます。

### 各フィールドの説明

| フィールド | 説明 |
|---|---|
| `id` | 他のシナリオと重複しない一意のID |
| `metadata.difficulty` | `"easy"` / `"medium"` / `"hard"` のいずれか |
| `customer.initials` | チャット画面のアバターに表示される1文字 |
| `hidden_context` | 採点時にAIへ渡される正解情報。受験者には表示されない |
| `eval_criteria` | 採点プロンプトに直接使われる4軸の評価観点 |
| `system_prompt` | 顧客AIへの演技指示。詳細なほどリアルな顧客を再現できる |

---

## 採点結果の確認

試験終了後、以下の方法で結果を確認できます：

- **Web画面：** 「採点結果一覧」タブ → 「HTMLで開く」
- **ファイル：** `data/results/{session_id}.html`（印刷・PDF保存可）

結果をまとめてリセットしたい場合は「採点結果一覧」タブ右上の「結果をリセット」ボタンを使用してください。

---

## トラブルシューティング

**「claude コマンドが見つかりません」**
→ `npm install -g @anthropic-ai/claude-code` を実行

**「認証エラー」が出る**
→ `claude login` を実行してログインし直す

**「ANTHROPIC_API_KEY が設定されています」という警告が出る**
→ `unset ANTHROPIC_API_KEY` を実行してから再起動

**応答に時間がかかる（10〜30秒）**
→ 正常です。`claude` コマンドの起動に数秒かかります。使用量が多い時間帯はさらに遅くなる場合があります。

**使用制限に達した場合**
→ しばらく待つか、その日だけUsage Creditsで継続できます。Pro プランより Max プランの方が上限が高いため、ヘビーな使用には Max を推奨します。
