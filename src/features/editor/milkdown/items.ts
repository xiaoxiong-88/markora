/** Slash command definitions. Each inserts a Markdown snippet or applies a
 * Milkdown command. `snippet` inserts markdown text at the slash position;
 * `command` names a registered Milkdown command with optional payload. */

export interface SlashItem {
  id: string;
  labelEn: string;
  labelZh: string;
  keywords: string;
  snippet?: string;
  command?: string;
  payload?: unknown;
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: "h1", labelEn: "Heading 1", labelZh: "一级标题", keywords: "h1 heading title", snippet: "# " },
  { id: "h2", labelEn: "Heading 2", labelZh: "二级标题", keywords: "h2 heading", snippet: "## " },
  { id: "h3", labelEn: "Heading 3", labelZh: "三级标题", keywords: "h3 heading", snippet: "### " },
  { id: "bullet", labelEn: "Bullet List", labelZh: "无序列表", keywords: "ul list bullet", snippet: "- " },
  { id: "ordered", labelEn: "Ordered List", labelZh: "有序列表", keywords: "ol list ordered", snippet: "1. " },
  { id: "task", labelEn: "Task List", labelZh: "任务列表", keywords: "todo task checkbox", snippet: "- [ ] " },
  { id: "quote", labelEn: "Quote", labelZh: "引用", keywords: "blockquote quote", snippet: "> " },
  {
    id: "code",
    labelEn: "Code Block",
    labelZh: "代码块",
    keywords: "code pre fence",
    snippet: "```\n\n```",
  },
  {
    id: "table",
    labelEn: "Table",
    labelZh: "表格",
    keywords: "table grid",
    snippet: "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |",
  },
  { id: "image", labelEn: "Image", labelZh: "图片", keywords: "image picture img", snippet: "![alt text]()" },
  { id: "link", labelEn: "Link", labelZh: "链接", keywords: "link url href", snippet: "[text](https://)" },
  {
    id: "math",
    labelEn: "Math Block",
    labelZh: "数学公式",
    keywords: "math katex tex formula",
    snippet: "$$\n\n$$",
  },
  {
    id: "mermaid",
    labelEn: "Mermaid Diagram",
    labelZh: "Mermaid 图表",
    keywords: "mermaid diagram chart flow",
    snippet: "```mermaid\nflowchart TD\n  A --> B\n```",
  },
  { id: "hr", labelEn: "Divider", labelZh: "分割线", keywords: "hr divider rule", snippet: "---" },
];
