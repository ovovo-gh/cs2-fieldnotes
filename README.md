# CS2 FIELDNOTES · 训练手记

根据《CS2 系统训练手册》制作的个人训练网站，适合学习、随手查阅和记录训练。

## 功能

- 17 章完整手册，全文搜索、分类、收藏、已学标记与章节清单。
- 灵敏度实验室：分别记录通用枪械与狙击 / 开镜配置，计算 eDPI、理论 cm/360，并用定点测试比较候选设置。
- 压枪训练台：覆盖步枪、冲锋枪、霰弹枪、机枪、手枪和狙击枪，叠加训练参照线与自己的压枪轨迹，自动给出误差、评分和建议。
- 今日训练打卡、个人训练重点、专注计时和最近 21 天训练概览。
- 八周训练计划与阶段验收。
- 复盘日志创建、编辑、分类与删除。
- JSON 备份导出与合并导入，原 Markdown 下载。
- 适配桌面与手机，支持键盘访问及章节打印。

## 数据保存

记录保存在当前浏览器的 localStorage 中，不会上传到 GitHub，不会跨设备自动同步。清理站点数据会删除记录，请定期导出 JSON 备份。导入按日期和日志编号合并，冲突以备份内容为准。灵敏度测试与压枪训练结果也会随 JSON 一起备份。

## 本地运行

纯静态文件，无服务器依赖或运行时 CDN。发布目录为 `site/`。

```sh
python3 -m http.server 4173 --directory site
```

打开 `http://localhost:4173`。全部导航使用 hash，兼容 GitHub Pages 项目子目录。

## 更新手册

修改根目录的手册，再运行：

```sh
python3 -m pip install -r requirements.txt
python3 scripts/build_content.py
```

生成的 `site/content.js` 和 `site/handbook.md` 一并提交。

## GitHub Pages

将 `site/` 内文件放到仓库根目录，在 Settings → Pages 选择 Deploy from a branch、main、/(root)。也可使用工作流将 `site/` 发布为 Pages artifact。无需 API 密钥。

## 内容说明

验收数值是自测建议，非官方段位标准。机制来源见手册第 17 章。该项目不是 Valve 官方产品。
