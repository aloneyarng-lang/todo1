# Materia 主题制作规范

新版外观使用一个主题、两种明暗模式。应用统一提供透明玻璃材质、局部反光、按压回弹、键盘焦点以及系统减少动画／透明度时的适配。主题负责配色、字体、图标和星图。

## 文件结构

继续使用 `format: "materia-theme"`、`schemaVersion: 2`。新增可选字段 `variants`；新制作的包必须填写 `light`、`dark` 两个对象。每个对象均需填写以下全部变量：

`--paper`、`--surface`、`--canvas`、`--panel`、`--sidebar`、`--ink`、`--muted`、`--line`、`--teal`、`--teal-light`、`--on-accent`、`--warning`、`--warning-soft`、`--danger`、`--danger-soft`、`--shadow`、`--theme-mode`。

`tokens` 保存默认外观和字体、星图变量；`variants` 仅保存配色，不能改变操作逻辑、字重或布局。浅色模式写 `--theme-mode: "light"`，深色写 `"dark"`。导出完整主题会同时保留两个模式。

## 材质与几何

`ui.style` 固定为 `glass`。`radius: 16`、`buttonRadius: 18`、`cardRadius: 20`、`menuRadius: 18`；界面不允许关闭玻璃。应用在导入旧主题时也统一采用这些值，旧包其他资源和星图仍保留。

背景使用单一纯色 `--paper`，不提供壁纸或彩色渐变。主体玻璃由应用控制：浅色主体白色约 12% 不透明度，深色主体黑色约 18%，菜单采用较高不透明度保证文字可读。不要用多个实色面板遮住玻璃，也不要降低文字不透明度来模拟玻璃。

主题色用于按钮、选择状态、图标及星图；主文字、辅助文字、危险按钮在明暗模式下都应有清楚的层级。校验器要求主文字与背景、强调按钮文字与强调色的对比度不低于 4.5。

## 字体、资源与旧包

界面推荐引用 `'Materia SF Pro', 'Materia Inter', 'Materia Source Han Sans', sans-serif`；等宽内容可引用 `'Materia SF Mono', 'Materia Source Code Pro', monospace`。这些名称使用软件已有资源，不将字体二进制写入主题文件。

内嵌资源继续使用现有声明式 SVG 和 Base64 字体接口，禁止脚本、远程资源及任意 CSS 选择器。字体必须附来源与原始许可。字体与字号的个人设置优先于主题，并在换肤和切换明暗时保留。

旧 CSS、旧版单模式主题仍能导入；软件会生成缺少的明暗配色，并统一适配玻璃。制作新主题需提供人工调整过的两个配色，不能依赖自动生成。

## 交付检查

运行 `node scripts/validate-theme-design.mjs <主题.mtheme.json>`。随后在两种模式中检查：星图和列表、文献详情、右键菜单、设置、PDF 阅读器、对比绘图和 AI 面板。检查窄窗口、125% 字号、键盘操作及减少动画设置；不加入品牌口号或冗余操作说明。
