<p align="center">
  <img src="docs/logo.svg" width="64" height="64" alt="answer-me-with-any のロゴ">
</p>

<h1 align="center">answer-me-with-any</h1>

<p align="center">
  <b>難しい質問に、文字の壁ではなく 1 枚の読める HTML ページで答えるエージェント用スキル。</b>
</p>

<p align="center">
  <img src="docs/images/text-vs-page.png" alt="同じ TCP の質問への 2 つの答え。左はターミナルに並んだ長い文章、右は図の入った 1 枚のページ" width="100%">
</p>

このリポジトリは [QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) のフォークです。スキルの仕組み・ベンチマーク・コンポーネントの一覧など、もとの README の内容は本家を見てください。

- 本家の README (英語): <https://github.com/QingYunA/answer-me-with-html#readme>
- 本家の README (简体中文): <https://github.com/QingYunA/answer-me-with-html/blob/main/README.zh-CN.md>
- 本家のサイト: <https://answer-me-with-html.com/>

## このフォークで変えたこと

| 変更 | 中身 |
| :--- | :--- |
| スキル名を `answer-me-with-any` に変更 | プラグイン・スキル・スラッシュコマンドの名前が `answer-me-with-any` になります。古い名前 (`answer-me-with-html`) で入れたものは残し、移し方を案内します |
| `--format md` | `am render --format md` で、ページを作らずに同じ内容をチャット用の Markdown として標準出力に出します。設定の `format` (`html` か `md`) で既定を変えられます |
| 返信のメタデータ (reply-meta) | 原稿の frontmatter に `reply-meta-<名前>: <値>` を書くと、ページのヘッダーに折りたたんで表示し、Reply ボタンでコピーする返信の末尾に JSON で付けます。エージェントどうしの受け渡しで ID などを返してもらうためのものです |

細かい仕様は [docs/reference.md](docs/reference.md) (英語) にあります。

## 使い方

入れたあとは、いつもどおりに質問します。

```
> TCP の 3 ウェイハンドシェイクを説明して
> このリポジトリのモジュールの関係を図にして
> キャッシュは Redis と Memcached のどちらがいい?
```

エージェントが短い Markdown の原稿を書き、スキルに同梱の CLI (`am`) がそれをページにします。図の座標・CSS・HTML は CLI が作るので、モデルが書くのは原稿だけです。

ページを作るかどうかはエージェントが決めます (概念どうしの関係、手順の多い流れ、いくつかの案の比較など)。「HTML で説明して」と頼んでも作ります。ページは `~/.answer-me-with-html/pages/` に保存されます。

## インストール

[Node.js](https://nodejs.org/) 20 以上が要ります。`npm install` は要りません (CLI はスキルの中に同梱されています)。

### エージェントに入れてもらう (おすすめ)

Claude Code・Codex・Cursor・OpenCode などのエージェントに、次の文を貼ります。

> Install Answer me with HTML: read https://raw.githubusercontent.com/reeschan/answer-me-with-any/main/INSTALL.md and follow it.

[INSTALL.md](INSTALL.md) はエージェントが読むための手順書です。Claude Code にはプラグインとして、ほかのエージェントにはスキルとして入れ、TCP のページを作って確かめてから結果を 1 回だけ報告します。

### Claude Code のプラグイン

Claude Code の中で次を実行します。

```
/plugin marketplace add reeschan/answer-me-with-any
/plugin install answer-me-with-any@answer-me-with-any
```

### コマンド 1 つで入れる

```bash
npx skills add reeschan/answer-me-with-any
```

入れ先のエージェントを聞かれます。聞かれずに入れるときは `npx -y skills add reeschan/answer-me-with-any -g -y -a claude-code` (`-a` にエージェントの名前) を使います。

<details>
<summary>手で入れる</summary>

`skills/answer-me-with-any` フォルダを、エージェントのスキルのフォルダにコピーします。Claude Code の場合:

```bash
git clone --depth 1 https://github.com/reeschan/answer-me-with-any.git /tmp/answer-me-with-any
cp -R /tmp/answer-me-with-any/skills/answer-me-with-any ~/.claude/skills/answer-me-with-any
```

ほかのエージェントのスキルのフォルダ: Codex は `~/.codex/skills/`、Cursor は `~/.cursor/skills/`、OpenCode は `~/.config/opencode/skill/`。

</details>

## 設定

設定はスラッシュコマンドで変えます。設定ファイルを手で書く必要はありません。

| どこで | どうする |
| :--- | :--- |
| Claude Code (プラグインで入れた場合) | `/answer-me-with-any:config` で変えたいものを聞かれます。`/answer-me-with-any:config open off` のように直接も変えられます |
| ほかのエージェント | `/answer-me-with-any config open off`、または「ブラウザで開かないで」と頼みます |
| ターミナル | `am config` で表示、`am config set open off` で変更、`am config reset` で既定に戻します |

主な設定は `open` (ブラウザで開く)・`theme`・`mode` (ライト / ダーク)・`style` (文章のチェック)・`format` (`html` か `md`) です。全部の設定と既定値は [docs/reference.md](docs/reference.md#settings) にあります。

## 常にページを付ける (always-on)

結論・まとめ・計画・比較を返すたびに、短い答えでも小さなページ (2〜4 枚のパネル) を付け、返事の最後にリンクを置くモードです。既定ではオフです。オンにするには、次の文をエージェントに貼り、ルールのファイル (`~/.claude/CLAUDE.md` や `AGENTS.md` など) に書き込んでもらいます。ルールの文は英語のまま使います。

> Turn on always-on mode for Answer me with HTML: add a global rule — "[answer-me-with-any always-on] Whenever a reply gives a conclusion, summary, plan, comparison, review or explanation, even a short one, also make a page with the answer-me-with-any skill (2 to 4 panels for routine answers), render it with --no-open before you write the reply, and end the reply with the page link in the format SKILL.md specifies for your host. Skip casual chat, one- or two-sentence replies with no conclusion, pure command output, and requests for plain text. An internal report to another agent is not a user reply: return the findings and evidence the parent asked for, and make no page unless the task explicitly asks for one."

オフにするときは、そのルールを消します。たまったページは `am clean` で消せます。

## 開発

```bash
git clone https://github.com/reeschan/answer-me-with-any.git && cd answer-me-with-any
npm install
npm test          # テストを走らせる
npm run build     # src/ を変えたら skills/answer-me-with-any/scripts/am.mjs を作り直す
npm run snapshot  # 作った HTML を origin/main と比べる (リファクタで変わってはいけない)
```

開発の決まりごと (生成物のバンドル・スナップショットの確かめ方・リリース) は [CONTRIBUTING.md](CONTRIBUTING.md) (英語) にあります。

## ライセンス

[MIT](LICENSE)。もとの著作は [QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) の作者によるものです。テーマが埋め込む Bangers フォントは [SIL Open Font License 1.1](skills/answer-me-with-any/licenses/OFL-Bangers.txt) です。
