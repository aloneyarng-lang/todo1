# 完整主题与外观（格式版本 2）

从左下角齿轮进入「主题与字体」。内置主题点击即应用并保存；导入主题会先作用于界面供预览，点击「应用并保存主题」后才写入当前文献库。「取消预览」或关闭主题窗口恢复此前外观。主题不会改变文献、笔记、性能数据、功能入口或快捷键。

## 六套内置外观

| 主题 | 字体与界面气质 | 图标 |
| --- | --- | --- |
| 学术纸白 | 宋体/Georgia 标题，编辑式留白，细边线，平面侧栏 | 细线轮廓 |
| 学术紫 | 等线正文、Georgia/楷体标题，圆润按钮与卡片，柔和阴影 | 圆润轮廓 |
| 深海蓝 | 无衬线技术标题，紧凑控件、方角、描边按钮 | 方笔技术图标 |
| 石墨夜读 | 深色控制台、较紧凑布局，等宽数字与代码 | 双色图标 |
| 暖砂手稿 | 西文衬线、中文楷体，较宽行距，条目式分隔线 | 轻线圆笔 |
| 维基百科 | Arial 正文、衬线标题，百科式蓝色链接、平面方角 | 关键语义实心图标 |

中文、英文字体按各自字体栈逐项回退。系统没有某种字体时会采用后备字体，不会下载字体。不同系统可用字体不同，字形可能略有差异。

## 主题默认与个人覆盖

「个人字体覆盖」可分别设置正文、标题、数字和等宽字体。优先级为：个人选择 → 主题指定字体/资源 → 字体栈中的后备字体。个人覆盖随文献库保存，切换或导入主题时保留；可逐项选择「跟随主题」，或点击「恢复跟随主题」。

主题支持字号、字重、行高、标题比例。星图标签会相应调整并重新避让。阅读器工具、批注编辑区、绘图控制面板、AI 助手、菜单与设置使用同一外观机制；PDF 原文、已写入 PDF 页面上的标注文字，以及科研图像内部的字体与白底保持独立。

## 导入与导出

「导入主题包 / CSS」支持：

- `.mtheme.json`：完整、自包含、可版本化的外观包，携带字体、界面风格与图标。
- `.css`：兼容旧版 `:root { --变量: 值; }` 文件，支持配色、字体、排版与基础圆角。缺少项目采用默认外观。

「主题文件 → 导出完整主题包」导出实际生效的外观，包括个人字体覆盖及资源，另一台电脑可直接导入；运行时生成的临时字体名称不会写入包中。「仅导出 CSS 变量」用于兼容旧格式，会省略完整包的 UI 风格、图标及二进制字体。

程序旁提供 `theme-template.mtheme.json`、`theme-template.css`。`theme-examples/blueprint.mtheme.json` 是可直接导入的完整示例：含真实 Source Code Pro 等宽字体、技术式面板和自定义 AI 助手图标。示例字体覆盖西文与数字，中文采用微软雅黑等后备字体；可替换为你有权分发的中文 WOFF2 字体。

主题资源随当前文献库的主题设置持久保存，导入后不依赖原文件。完整文献 JSON 备份主要包含文献数据；迁移主题请导出完整主题包，或复制整个文献库文件夹。大量完整中文字体会增大主题设置与文献库文件，建议使用 WOFF2 子集。单个主题包限 24 MB，最多 8 个字体，每个字体限 12 MB，字体合计限 16 MB；最多 20 个自定义主题，已存主题资源合计限 48 MB。

## 完整包结构

```json
{
  "format": "materia-theme",
  "schemaVersion": 2,
  "name": "我的研究主题",
  "description": "无衬线技术版面与圆润图标",
  "tokens": {
    "--paper": "#edf2f6",
    "--surface": "#ffffff",
    "--ink": "#233f55",
    "--teal": "#285f8a"
  },
  "typography": {
    "body": {"family": "DengXian, 'Microsoft YaHei', sans-serif", "size": 13, "weight": 400, "lineHeight": 1.7},
    "heading": {"family": "Georgia, KaiTi, SimSun, serif", "scale": 1.04, "weight": 400, "lineHeight": 1.5},
    "numeric": {"family": "Consolas, 'Microsoft YaHei', monospace"},
    "mono": {"family": "Consolas, monospace"}
  },
  "ui": {
    "style": "technical", "density": 0.94,
    "radius": 3, "buttonRadius": 3, "cardRadius": 3, "menuRadius": 4,
    "borderWidth": 1, "sidebarWidth": 212, "controlHeight": 33,
    "cardPadding": 13, "menuPadding": 6, "cardGap": 8,
    "buttonStyle": "outlined", "cardStyle": "outlined",
    "sidebarStyle": "ruled", "shadow": "none"
  },
  "icons": {"style": "rounded", "strokeWidth": 1.6, "size": 18, "overrides": {}},
  "assets": {"fonts": []}
}
```

缺失字段使用默认值，未知字段或未来版本会给出错误提示。`typography` 会规范化为排版变量；导出包以 `tokens` 保存规范化后的实际值。

| 项目 | 可用值 / 范围 |
| --- | --- |
| `ui.style` | `editorial`、`soft`、`technical`、`manuscript`、`encyclopedia`，均可用于导入主题 |
| `density` | 0.86–1.14；不会缩小主要点击目标到 30px 以下 |
| `radius` / `buttonRadius` / `cardRadius` / `menuRadius` | 0–20 / 0–22 / 0–20 / 0–18，单位 px |
| `borderWidth` | 0.5–2px |
| `sidebarWidth` / `controlHeight` | 188–244 / 30–40px |
| `cardPadding` / `menuPadding` / `cardGap` | 10–22 / 4–12 / 6–18px |
| `buttonStyle` | `solid`、`outlined`、`soft` |
| `cardStyle` | `flat`、`outlined`、`elevated`、`ruled` |
| `sidebarStyle` | `flat`、`tinted`、`ruled` |
| `shadow` | `none`、`soft`、`lifted` |
| `icons.style` | `outline`、`rounded`、`technical`、`duotone`、`solid` |
| `icons.strokeWidth` / `icons.size` | 1–2.4 / 16–21px |
| 正文字号 / 字重 / 行高 | 11–16px / 300–700 整百 / 1.2–2 |
| 标题比例 / 行高 | 0.85–1.2 / 1.2–2 |

## 颜色与排版变量

| 变量 | 用途 |
| --- | --- |
| `--paper` / `--surface` | 背景 / 内容面板与弹窗 |
| `--canvas` / `--panel` / `--sidebar` | 星图 / 次级底色 / 侧栏 |
| `--ink` / `--muted` / `--line` | 正文 / 辅助文字 / 边线 |
| `--teal` / `--teal-light` / `--on-accent` | 强调色 / 选中底色 / 强调色上的文字 |
| `--warning` / `--warning-soft` / `--danger` / `--danger-soft` | 提示及错误的文字与底色 |
| `--shadow` / `--theme-mode` | 阴影颜色 / `light` 或 `dark` 原生控件风格 |
| `--sans` / `--serif` / `--numeric` / `--mono` | 正文 / 标题 / 数字 / 等宽字体栈 |
| `--font-size` / `--font-weight` / `--line-height` | 正文字号（如 `13px`）/ 字重 / 行高 |
| `--heading-scale` / `--heading-weight` / `--heading-line-height` | 标题比例 / 字重 / 行高 |
| `--radius` | 旧格式主要控件圆角 |

颜色支持十六进制、rgb/rgba 和 hsl/hsla。深色主题需要同时提供适合的背景、文字与边线。普通 CSS 选择器、脚本、远程样式和任意布局规则不属于主题格式。

## 字体资源与打包

最终包的 `assets.fonts` 中每项使用：

```json
{"id":"lab-mono","family":"Materia Lab Mono","format":"woff2","data":"字体二进制的Base64编码","weight":"400","style":"normal","license":"字体分发许可证全文","source":"字体来源说明"}
```

`family` 与字体栈中的名字一致；程序使用隔离的运行时别名加载，避免与其他主题冲突。格式支持 WOFF2、WOFF、TTF、OTF；字重支持 `400` 或可变字体范围 `300 700`。同一字体族可用不同 `id` 提供多种字重。文件头、大小和浏览器解码均会检查。未加载的资源或缺少的字形回退到字体栈；损坏的导入资源不会提交，已保存资源损坏时仍可打开界面并显示回退状态。

制作时不必手写 Base64。可参照 `theme-examples/blueprint-source/manifest.json`：字体项使用 `file`、`licenseFile` 指向源文件夹内的相对路径；图标覆盖可使用 `{"file":"icons/assistant.json"}`。在 Materia 源码项目目录运行以下打包工具（需要 Node.js；桌面使用者直接导入生成的 JSON，不需要 Node.js）：

```sh
node scripts/pack-theme.mjs theme-examples/blueprint-source/manifest.json output.mtheme.json
```

生成的一个 JSON 文件即完整主题包。打包器不读取源文件夹外的资源，不依赖外网。字体应保留相应分发许可。示例使用未修改的 [Adobe Source Code Pro](https://github.com/adobe-fonts/source-code-pro)，SIL Open Font License 见示例文件夹及包内 `license`。

## 图标覆盖

图标保留 24×24 坐标系，以语义名指定覆盖。图标按钮的名称、悬停说明、键盘操作仍由程序提供。未覆盖或未注册的图标回退到同一默认体系，避免空白按钮。

```json
{
  "icons": {
    "style": "technical",
    "strokeWidth": 1.7,
    "size": 19,
    "overrides": {
      "assistant": [
        {"tag":"rect","attrs":{"x":3,"y":4,"width":18,"height":14,"rx":2}},
        {"tag":"path","attrs":{"d":"M7 18v4l5-4M8 11h8M12 7v8"}}
      ]
    }
  }
}
```

支持 path、rect、circle、ellipse、line、polyline、polygon；每个图标最多 32 个图形。颜色使用 `currentColor` 或 `none`，可附 opacity、fill-opacity 和 stroke-width；不接受脚本、事件属性、外部引用或 raw SVG/HTML。常用语义名包括 assistant、orbit、library、folder、tag、star、settings、search、chart、table、ruler、plus、minus、close、more、image、text、area、cursor、arrow-diagonal。完整名称列表见 `dist/icons.js` 的 `ICON_NAMES`。

## 验证与限制

已验证六套内置外观、旧 CSS、完整包的导入预览/取消/保存、导出往返、四种个人字体覆盖、重启资源恢复、字体损坏回退和连续切换。页面覆盖列表、星图、阅读器控件、笔记编辑、科研图控制区、AI 助手与设置；包含正常窗口与 1000px 窄窗口。示例中文采用系统后备字体，实际中文字体差异取决于本机安装情况或自行提供的字体资源。当前不支持 TTC/OTC、远程字体、插件脚本或任意 CSS 布局替换。
