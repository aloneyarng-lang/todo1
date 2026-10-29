# 命运石之门 · 世界线

已内置到 Materia。完全退出并重新打开后，在「主题与字体」选择「命运石之门」，顶部切换浅色／深色。

浅色采用暖灰白玻璃与铜橙强调；深色采用墨灰玻璃与琥珀橙高光。数字采用内置 SF Mono 等宽字体，界面与正文采用 SF Pro 和思源黑体。仪表管、齿轮、时间刻度与世界线分支均为本主题重新绘制的声明式 SVG，不包含角色壁纸或字体二进制。

星图形态设为「跟随主题包」时，文献节点呈现仪表管，关联节点呈现刻度和分支交汇。需要与其他界面配色组合时，可单独选择「主题形态 · 命运石之门」。星图只绘制现有真实关联。

`命运石之门-世界线.mtheme.json` 是独立的双模式主题包，可在其他兼容版本中导入。引用软件内置字体，保留无字体时的系统后备栈。`build.mjs` 从软件内置设计和根目录模板生成此文件。

生成与检查：

```powershell
node theme-examples/steins-gate/build.mjs
node scripts/validate-theme-design.mjs theme-examples/steins-gate/命运石之门-世界线.mtheme.json
```

主题设计规范见上级目录的 `DESIGN_RULES.md`。视觉概念参考作品的世界线与实验室仪表意象：[官方仪表展示](https://steinsgate.jp/5th/result.html)。本主题为 Materia 的同人界面设计。
