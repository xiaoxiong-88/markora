# Markora — 产品需求规格（权威需求文档）

> 本文件是 Markora 的完整需求规格。实现时必须逐项对照；暂时无法完成的功能必须在代码和 README 中明确标记为未完成，不得伪装为可用。

## 定位

免费、本地优先、隐私友好、启动快速、界面精致，体验尽可能接近 Typora 的 Markdown 桌面编辑器。

## 执行原则

- 真实实现：不允许空按钮、假数据、只有 UI 没有行为。
- 使用当前稳定且彼此兼容的依赖版本，优先官方库和 Tauri 官方插件。
- 优先保证：数据不丢失、Markdown 内容不被意外改写、中文输入法正常、保存可靠、撤销/重做/光标稳定、macOS Intel 可运行。
- 平台优先级：macOS Apple Silicon arm64 > macOS Intel x86_64 > Windows 10/11 > Linux。当前阶段优先完成并验证 macOS Apple Silicon，其他平台保持跨平台构建能力但可延后。项目需具备跨平台构建能力。
- 包管理器统一使用 pnpm。`pnpm install` / `pnpm tauri dev` / `pnpm tauri build` 必须可用。

## 技术栈

- 桌面：Tauri 2，Rust stable，最小权限 capabilities。官方插件优先：dialog、fs、opener、store、clipboard-manager、window-state、process。shell 仅在确有必要时启用。
- 前端：React + TypeScript strict + Vite + Zustand。CSS Variables + Tailwind CSS（或结构清晰的 CSS Modules）。Radix UI 或同级无障碍基础组件。Lucide Icons。禁止业务代码散落硬编码颜色。
- 编辑器双架构：
  - 所见即所得：Milkdown（ProseMirror）。Markdown 是唯一持久化数据源，必须可靠序列化回 Markdown。
  - 源码：CodeMirror 6，Markdown 高亮、行号可配置、自动补全括号、搜索替换、多光标、撤销重做、当前行高亮、自动换行、支持超长行。
- Markdown 能力：CommonMark、GFM、YAML Front Matter、表格、任务列表、删除线、脚注、自动标题锚点、KaTeX、Mermaid、Shiki 代码高亮、安全 HTML 策略（禁止未过滤执行任意 HTML/JS/远程脚本）。

## 主界面布局

```
┌──────────────────────────────────────────────────────┐
│ Title Bar / Tabs / Window Controls                    │
├─────────────┬──────────────────────────┬─────────────┤
│ Workspace   │        Editor            │ Outline     │
├─────────────┴──────────────────────────┴─────────────┤
│ Status Bar                                           │
└──────────────────────────────────────────────────────┘
```

布局状态：文件侧边栏显示/隐藏、大纲显示/隐藏、全屏、专注模式、打字机模式、WYSIWYG / 源码 / 分栏预览 / 阅读四种编辑模式。布局状态自动保存。

## 文件与工作区

- 文件操作：打开 md 文件、打开文件夹为工作区、新建文件/文件夹、保存、另存为、全部保存、重命名、移动、复制、删除到废纸篓（跨平台不可安全实现则明确确认）、在系统文件管理器中显示、系统默认程序打开、最近文件、最近文件夹、拖入文件/文件夹、双击 .md 打开（文件关联）、恢复上次会话。
- 扩展名：.md .markdown .mdown .mkd .txt
- 文件树：展开/折叠、当前文件高亮、右键菜单、图标、按名称排序、可选显示隐藏文件、可配置忽略规则（默认忽略 .git、node_modules、构建目录）、刷新、外部增删自动同步、工作区内搜索文件、快速打开、大目录懒加载。
- 保存可靠性：UTF-8；保留或统一换行符；临时文件+原子替换；保存失败不清除未保存状态并显示清晰错误；防抖自动保存且延时可配置可关闭；退出/关标签前检查未保存；崩溃恢复未保存内容并有清理策略。
- 外部修改冲突：监听当前文件。无本地修改→自动重载+轻提示；有本地修改→冲突界面：查看差异、保留本地、加载磁盘、另存本地、手动合并。绝不直接覆盖未保存内容。

## 编辑模式

1. WYSIWYG（接近 Typora）：标记弱化/隐藏、光标进入显示语义、标题实时排版、粗斜删、行内代码、引用、有序/无序/任务列表、水平线、链接、图片、表格、代码块、数学公式、Mermaid、脚注。正确处理：中文 IME、中文标点、Emoji、Unicode、粘贴纯文本/网页富文本/Word、撤销重做、光标跨节点、列表回车缩进、Backspace 合并、空列表退出、代码块输入、大段粘贴、快速输入。
2. 源码模式（CM6）：高亮、行号开关、换行、Tab 宽度、当前行高亮、括号匹配、搜索/替换/全部替换/正则/区分大小写、多光标、上下移动行、复制行、删除行、注释切换、跳转行、代码折叠、选区字数统计。
3. 分栏预览：左 CM6 右渲染，实时防抖预览、双向滚动同步（基于标题/段落/源位置锚点映射，非简单百分比）、大纲定位、点预览标题定位源码、代码高亮、KaTeX、Mermaid、图片路径解析、主题同步。
4. 阅读模式：禁编辑、最大正文宽度、图片点击放大、代码块可复制、链接可点击、标题锚点、目录导航、打印。

## 标签页与会话

每标签维护：文件路径、文件名、markdown、savedMarkdown、isDirty、编辑模式、光标位置、滚动位置、历史状态、编码信息、外部修改状态。支持：新建/关闭/关闭其他/关闭右侧/重开刚关闭/拖动排序/固定/中键关闭/重名显示父目录/未保存圆点/恢复标签顺序/恢复光标滚动。切换标签不丢编辑器状态。

## 编辑效率

- 命令面板 Cmd/Ctrl+Shift+P：打开文件/文件夹、保存、切主题、切模式、侧栏/大纲、导出、查找、跳标题、专注、打字机、设置。
- 快速打开 Cmd/Ctrl+P：工作区文件模糊搜索。
- 格式快捷键：粗体、斜体、行内代码、删除线、链接、图片、标题级别、引用、三种列表、代码块、水平线、表格、数学公式、Mermaid。遵循 macOS 与 Win/Linux 习惯。
- 浮动工具栏：选中时显示（粗/斜/删/行内代码/链接/标题/引用），不遮挡选区，支持键盘。
- Slash Command：空段落输入 `/` 出菜单（标题/列表/引用/代码块/表格/图片/链接/公式/Mermaid/分割线），键盘上下+回车。

## 表格

插入指定行列、增删行列、拖调列宽、左/中/右对齐、Tab 跳下一格、最后一格 Tab 新增行、多格复制粘贴、TSV/电子表格粘贴生成表格、右键菜单、合法 Markdown 序列化。不要因编辑表格破坏整个文档的可读 Markdown。

## 代码块

语言选择+模糊搜索、语法高亮、行号开关、复制按钮、自动缩进、Tab 输入、块内搜索、长代码横向滚动、自动识别常见语言、Mermaid 特殊渲染、源码/预览切换。

## 数学公式（KaTeX）

行内 `$...$`、块级 `$$...$$`、实时预览、错误提示且不拖垮整篇渲染、可复制 LaTeX 源码、导出/打印正常。

## Mermaid

常用图表、实时渲染、编辑/预览切换、错误定位到当前图表且不影响其他内容、深色适配、导出/打印可见、安全配置、不加载远程脚本、避免重复初始化内存泄漏。

## 图片与附件

- 显示：相对/绝对/file:// /工作区/URL 路径、含空格、中文名、URL 编码、不存在图片→明确占位符+原始路径。
- 插入：拖入、剪贴板截图、选择本地、远程 URL。本地图片默认复制到资源目录（当前目录/assets/images/自定义，可配置）。自动建目录、冲突处理、文件名清理、保留扩展名、相对路径插入、可撤销、复制失败不插入无效 Markdown。
- 查看：点击放大、缩放、拖动、复制图片、系统中打开、原始尺寸、编辑 alt、编辑路径。

## 大纲

H1–H6、层级缩进、当前高亮、点击跳转、实时更新、重复标题稳定锚点、大纲搜索、折叠层级。拖动调整章节顺序可作为后续增强，不得破坏文档。

## 搜索

- 文档内：搜索、替换、全部替换、正则、大小写、全词、计数、上/下一个。
- 工作区全文：搜 md/txt、显示文件名/行号/上下文、点击定位、忽略二进制、忽略配置目录、限制单文件大小、可取消、不阻塞 UI。优先 Rust 后端实现。

## 主题

内置 Light / Dark / Sepia / High Contrast。跟随系统、手动切换、编辑器主题、代码高亮主题、Mermaid 主题、自定义字体、字号、行高、内容最大宽度、段落间距、缩放、侧栏宽度、大纲宽度。统一 CSS Variables。无默认浏览器控件感。macOS 自然标题栏/圆角/阴影/交通灯/快捷键，不以破坏 Win/Linux 为代价。

## 专注/打字机

专注：弱化非当前段落（程度可配）、当前段落清晰、切换不改内容。打字机：当前行保持视口中央、上下留白、平滑更新不抖动。可同时启用。

## 状态栏

保存状态、编码、换行符、编辑模式、标题层级、行列、字符数、不含空格字符数、单词数、段落数、阅读时间、文件大小、缩放。部分可点击改设置。中文统计不按空格分词。

## 导入导出打印

- HTML 导出：单文件、嵌入主题样式、可选嵌入本地图片、保留 KaTeX/Mermaid/代码高亮、语义化 HTML、标题与元数据、安全处理。
- PDF：打印预览 + 系统打印（用户可存 PDF）、打印 CSS、A4/Letter、页边距、页眉页脚开关、代码块避免不合理分页、表格避免截断、深色主题打印用浅色。不打包 Chromium。
- 可选：纯文本、Markdown 副本、带资源文件夹 HTML。DOCX/EPUB 非优先级。

## 设置中心

- General：恢复会话、自动保存+延迟、默认编辑模式、默认主题、语言、最近文件数量、关闭最后窗口行为。
- Editor：字体、字号、行高、Tab 宽、换行、行号、拼写检查、智能标点、自动配对、专注、打字机。
- Markdown：GFM、HTML 支持、数学、Mermaid、自动链接、标题锚点、Front Matter、图片资源目录。
- Appearance：主题、内容宽度、侧栏、大纲、动画开关、减少动态。
- Files：默认编码、换行符、末尾换行、忽略目录、外部修改检测。
- 即时生效+持久化。提供恢复默认。

## 欢迎页

无文档时显示：新建、打开文件、打开文件夹、最近文件、最近工作区、快捷键提示、版本。简洁，不做营销页。

## 错误处理

统一机制：文件不存在、权限不足、占用、非 UTF-8、过大、保存失败、磁盘不足、图片复制失败、Mermaid/KaTeX 失败、导出失败、设置损坏、会话恢复失败、外部冲突。提示可理解、有上下文、不暴露无意义堆栈、可展开技术详情、提供解决动作、不白屏。React Error Boundary。Rust 错误转结构化对象。

## 安全

最小 capabilities、明确 CSP、禁远程脚本、禁 Markdown 内嵌 JS、外链系统浏览器打开+协议检查、防路径穿越、防图片路径读取敏感文件、不执行代码块、Mermaid 安全配置、导出清理、不收集遥测、不上传、不默认联网、无广告、无登录、无云同步、无 API Key。README 写明隐私模型。

## 性能

启动快、1MB md 流畅、大工作区不冻结、预览/大纲防抖、Mermaid 增量或延迟渲染、非当前标签避免渲染、图片懒加载、长列表虚拟化、搜索可取消、Rust 扫描不阻塞主线程、编辑器实例不重复创建、避免无意义重渲染、Mermaid/Shiki 不重复初始化、无监听器泄漏。超大文件可提供性能模式（明确提示）。

## 无障碍

按钮有可访问名、完整键盘操作、清晰焦点样式、合理 ARIA、对话框焦点锁定、Esc 关弹窗、减少动态、高对比主题、不只靠颜色、菜单显示快捷键、系统字体缩放。

## 项目结构

```
markora/
├── src/ {app, components, features/{editor,workspace,tabs,outline,search,export,settings,command-palette}, hooks, services, stores, lib, styles, types, test}
├── src-tauri/ {capabilities, src/{commands,filesystem,search,watcher,export,errors,main.rs}, Cargo.toml, tauri.conf.json}
├── tests/  fixtures/  docs/{ARCHITECTURE.md,SECURITY.md,DEVELOPMENT.md}
├── README.md  package.json  pnpm-lock.yaml
```

不要把所有逻辑放在少数超大文件；单文件明显过大要主动拆分。

## 代码质量

TS strict、禁滥用 any、明确类型、组件职责单一、不滥用全局状态、cargo fmt、clippy、ESLint、统一格式化、必要注释、无调试日志、不提交构建产物/绝对路径/密钥。用户可见文本集中管理，中英文界面基础支持，默认按系统语言。

## 测试

- 前端（Vitest + RTL）：文档状态、标签页、未保存判断、路径处理、最近文件、设置持久化、字数统计、大纲解析、Markdown 序列化、图片相对路径、外部冲突状态、命令注册。
- Rust：原子写入、路径安全、扩展名过滤、工作区扫描、忽略规则、文本搜索、编码检测、冲突判断、结构化错误转换。
- 集成：新建→输入→切模式→保存→重开一致；打开文件夹→树打开→修改→未保存；外部冲突；搜索替换；插入图片；HTML 导出。用临时目录，禁止操作用户真实文件。

## 质量检查命令

`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`、`pnpm tauri build`。交付前实际运行能运行的检查，遇到错误必须修复。若缺系统依赖导致安装包无法生成：仍完成全部源码+前端构建+Rust 检查，说明缺什么，不得谎称验证成功。

## CI

GitHub Actions：前端 lint、typecheck、测试、Rust fmt/clippy/test、构建检查。可加 macOS/Windows/Linux 矩阵。无证书不伪造签名或自动发布。

## 文档

README.md（介绍、截图占位、功能、技术栈、环境要求、安装、开发、测试、构建、结构、隐私、已知限制、Roadmap、License 建议）；docs/ARCHITECTURE.md（前后端职责、文件系统、文档状态模型、多标签、Markdown 数据流、Milkdown↔CodeMirror 同步策略、自动保存、外部冲突、工作区搜索、导出流程）；docs/SECURITY.md（Tauri 权限、CSP、HTML 策略、Mermaid 策略、文件访问范围、外链策略、隐私模型、安全报告方式）；docs/DEVELOPMENT.md（环境、常见错误、调试、添加命令/主题/Markdown 扩展、测试规范）。

## 视觉设计

克制、现代、精致、原生桌面感。细腻灰阶、低对比分隔线、清晰排版、合理留白、正文居中、动画 120–200ms、支持减少动态、深色不是简单反色。中英文混排良好。系统字体优先，不打包商业字体。

## 默认快捷键（统一快捷键系统，不散落硬编码）

New Cmd/Ctrl+N；Open File Cmd/Ctrl+O；Open Folder Cmd/Ctrl+Shift+O；Save Cmd/Ctrl+S；Save As Cmd/Ctrl+Shift+S；Close Tab Cmd/Ctrl+W；Reopen Closed Tab Cmd/Ctrl+Shift+T；Quick Open Cmd/Ctrl+P；Command Palette Cmd/Ctrl+Shift+P；Find Cmd/Ctrl+F；Replace Cmd/Ctrl+H；Workspace Search Cmd/Ctrl+Shift+F；Bold Cmd/Ctrl+B；Italic Cmd/Ctrl+I；Link Cmd/Ctrl+K；Source Mode Cmd/Ctrl+/；Toggle Sidebar Cmd/Ctrl+Shift+B；Focus F8；Typewriter F9；Fullscreen 平台习惯；Zoom In/Out/Reset Cmd/Ctrl +/- /0。检测冲突并按平台适配。

## 核心数据模型

```ts
type DocumentId = string;
interface DocumentSession {
  id: DocumentId;
  filePath: string | null;
  displayName: string;
  markdown: string;
  savedMarkdown: string;
  isDirty: boolean;
  mode: "wysiwyg" | "source" | "split" | "reader";
  cursorState: CursorState | null;
  scrollState: ScrollState;
  fileMetadata: FileMetadata | null;
  externalChangeState: ExternalChangeState;
}
```

原则：markdown 当前内容；savedMarkdown 最后保存内容；isDirty 明确规则计算；编辑器实例不入全局状态；路径跨平台安全；Rust↔TS 明确序列化格式；不用文件路径作永久唯一 ID。

## 编辑器同步策略（单一活动编辑器）

1. 当前模式编辑器是唯一写入方；2. 变更更新统一 markdown 状态；3. 切模式：先取当前编辑器最新 markdown→更新统一状态→再初始化目标编辑器；4. 版本号/来源标记防循环更新；5. 尽量映射光标滚动；6. 自动保存只监听统一状态；7. 不按每次按键重建编辑器。架构文档必须解释。

## 验收场景

- A 基础编辑：启动→新建→中英文 Emoji→标题/列表/表格/代码块→撤销重做→保存→重开一致。
- B 模式切换：WYSIWYG↔源码语义正确、无重复文本、无循环更新、不丢中文。
- C 工作区：打开多子目录→展开→开多文件→重命名→新建→搜索→定位。
- D 外部冲突：本地未保存+磁盘被改→检测→比较→不自动覆盖。
- E 扩展：GFM 表格、任务列表、脚注、Front Matter、KaTeX、Mermaid、多语言代码块、本地/远程图片、中文路径。
- F 导出：HTML 浏览器打开样式/图片/高亮/公式/Mermaid 正常、打印预览正常。

## 完成标准

应用能启动；打开/编辑/可靠保存；WYSIWYG/源码/分栏；工作区；多标签；大纲；搜索；图片；表格；KaTeX；Mermaid；自动保存；外部修改检测；主题；快捷键；HTML 导出+打印；设置/会话持久化；核心测试通过；lint/typecheck 通过；cargo fmt/clippy/test 通过；README 与架构文档完整；无空实现假功能。

## 执行顺序

Phase 1 基础工程 → Phase 2 文档/文件系统 → Phase 3 编辑器 → Phase 4 工作区 → Phase 5 Markdown 增强 → Phase 6 产品体验 → Phase 7 质量。不要在 Phase 1 后停止，持续到当前环境最大完成度。
