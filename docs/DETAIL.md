# 大梦 · 人生调研

在 DSH 对话里完成一次 140 题的人生调研，并把回答蒸馏成数字人档案。

## 它提供什么

- 14 章、140 题（主线 64 题），中文 / English / 日本語 / 한국어。
- `dameng_status`：进度、分章覆盖、下一题。
- `dameng_questions`：按章节或全局取下一批题目，含提示与追问。
- `dameng_answer`：逐字记录回答，或标记跳过。
- `dameng_guide`：访谈协议（一次一题、具体化、追问、安全边界）。
- `dameng_export`：生成人生档案、蒸馏指令、覆盖报告、回答备份、下一步，全部使用当前语言。

## 数据在哪

回答默认写入 `$DSH_HOME/dameng/answers.json`（通常是 `~/.dsh/dameng/answers.json`），不会进入工作区或 Git。导出默认写入同一目录下的 `exports/`。设置 `DAMENG_DATA_DIR` 可以改位置。

## 怎么用

1. 对 agent 说：“开始大梦访谈。”
2. agent 调用 `dameng_guide`，再按 `dameng_questions` 一次问一题。
3. 回答后用 `dameng_answer` 原话记录；不想答就 `skip: true`。
4. 需要档案时调用 `dameng_export`，把《蒸馏指令》交给一个强模型生成 `persona.md`。

## 边界

这是自我调研工具，不是心理测量或诊断。数字人是镜子，不是替身；不要用它冒充本人作出承诺、签署或转账。涉及自伤、自杀或暴力时，停止访谈并联系专业援助（中国大陆可拨 12356）。
