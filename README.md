# CS2 FIELDNOTES · 训练手记

CS2 个人训练网站：17 章完整训练手册、每日打卡、专注计时、八周进阶计划、灵敏度实验室、自动武器逐发计时压枪训练、三张老地图战术板与复盘日志。

## 使用

在训练台勾选当天练习；在灵敏度实验室分别测试通用枪械和狙击 / 开镜设置；在压枪训练台选择 AK、M4、Galil 等可连续扫射武器，按每把枪的射速逐发跟随目标；在学习手册搜索急停、AWP、残局等内容；在复盘日志记录当时的信息、改法与下一场重点。

在“地图战术板”查看沙2、Mirage、小镇的官方雷达平面图，筛选烟雾、闪光、HE 和火焰的效果示意，并查看单人上限、五人队伍理论上限与关键投掷卡。地图 PNG 和 overview 坐标按 2026-09-11 快照固定在 `maps/` 与 `tactics-data.js`；投掷卡链接到可追溯的单颗投掷页，卡面路线图是教学示意，不替代当前练习房复核。

记录仅保存在当前浏览器，不会上传到 GitHub，也不会跨设备自动同步。请通过“备份与数据管理”定期导出 JSON；换设备时可导入，冲突记录以备份为准。

## 网站文件

- `index.html`：页面与公共导航。
- `styles.css`：响应式界面样式。
- `app.js`：打卡、阅读、计划、日志、灵敏度实验室、压枪训练与备份。
- `recoil-data.js`：可连续扫射武器逐发后坐力补偿增量；页面启动时累积成参考路径，并按每把枪的 RPM 播放。
- `tactics-data.js`：沙2、Mirage、小镇的官方雷达快照元数据、道具规则、效果示意与关键投掷卡。
- `maps/`：从官方游戏 depot 同步的三张本地雷达 PNG；地图底图版权归 Valve Corporation。
- `content.js`：完整章节数据。
- `handbook.md`：原始训练手册。
- `favicon.svg`：站点图标。

纯静态网站，无运行时依赖、无 API 密钥、无第三方追踪。GitHub Pages 配置为 main 分支、根目录发布。

本地可运行 `python3 -m http.server 4173`，然后打开 `http://localhost:4173`。

压枪页只保留 16 把可连续扫射的步枪、冲锋枪和机枪：M4A1-S 为 20 发/匣，Galil AR 为 35 发/匣。狙击枪、点射 / 单发手枪和霰弹枪不会被伪造为固定全自动弹道。训练会在每一发的截止时刻读取鼠标位置；固定线是无散布的标准化逐发参考，实际命中仍受站姿、移动、距离和散布影响。

地图战术板的数量口径为：烟雾、HE、燃烧瓶 / 燃烧弹每位玩家最多 1 颗，五人队伍理论上限 5 颗；闪光每位玩家最多 2 颗，五人队伍理论上限 10 颗。彩色范围是可读的教学覆盖示意，不是游戏内部碰撞或可见性像素；真实效果仍受距离、视角、材质、火焰扩散与地图几何影响。

数据校验以 [Valve 的 2026-03-18 更新说明](https://www.counter-strike.net/newsentry/532126482488623360) 的换弹机制为准，并用 [GameTracking-CS2 的武器弹匣字段定义](https://github.com/SteamTracking/GameTracking-CS2/blob/master/DumpSource2/schemas/server/CBasePlayerWeaponVData.h) 和 [CSDB 的逐发后坐力参考](https://csdb.gg/recoil-patterns/) 交叉核对。固定路径数据离线打包在 `recoil-data.js`，因此网页不依赖接口；它代表逐发后坐力 / 补偿形状，不承诺带随机散布的实际命中点。

地图底图来源为 [CS2 Map Icons](https://github.com/MurkyYT/cs2-map-icons) 的官方 depot 同步说明与 [GameTracking-CS2 的官方 overview 文件](https://github.com/SteamTracking/GameTracking-CS2/tree/master/game/csgo/pak01_dir/resource/overviews)；道具实体与分类核对 [GameTracking-CS2 的 weapons.vdata](https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/master/game/csgo/pak01_dir/scripts/weapons.vdata)，关键投掷手法和飞行时间链接到卡片中的 [CSNADES 地图指南](https://csnades.gg/guides)。

训练目标为自测建议，非官方段位标准；机制来源见第 17 章。该项目不是 Valve 官方产品。
