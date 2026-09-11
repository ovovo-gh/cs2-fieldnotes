// CS2 map tactics data, frozen for the 2026-09-11 site build.
// The radar images and overview calibration come from the official-game-depot
// snapshots published by cs2-map-icons. Utility class names and throw velocity
// are cross-checked against Valve's GameTracking-CS2 weapons.vdata.
window.CS2_TACTICS_DATA = {
  snapshot: '2026-09-11',
  radarSource: 'https://github.com/MurkyYT/cs2-map-icons',
  overviewSource: 'https://github.com/SteamTracking/GameTracking-CS2/tree/master/game/csgo/pak01_dir/resource/overviews',
  utilitySource: 'https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/master/game/csgo/pak01_dir/scripts/weapons.vdata',
  lineupSource: 'https://csnades.gg/guides',
  utilityTypes: [
    {
      id: 'smoke',
      short: '烟',
      icon: '☁',
      name: '烟雾弹',
      className: 'weapon_smokegrenade',
      perPlayer: 1,
      teamMax: 5,
      duration: '18 秒烟云',
      durationSeconds: 18,
      trigger: '落地后生成烟云',
      effect: '遮挡视线；子弹与爆炸会短暂扰动烟云，火焰可以将烟熄灭。',
      color: '#b4cec5'
    },
    {
      id: 'flash',
      short: '闪',
      icon: '✦',
      name: '闪光弹',
      className: 'weapon_flashbang',
      perPlayer: 2,
      teamMax: 10,
      duration: '最长约 5 秒致盲',
      durationSeconds: 5,
      timelineStartSeconds: 1.5,
      trigger: '约 1.5 秒后爆炸',
      effect: '按距离、视角与遮挡程度产生不同程度的致盲和耳鸣；背身或被遮挡会显著减弱。',
      color: '#f2dca5'
    },
    {
      id: 'he',
      short: 'HE',
      icon: '◆',
      name: '高爆手雷',
      className: 'weapon_hegrenade',
      perPlayer: 1,
      teamMax: 5,
      duration: '瞬时爆炸',
      durationSeconds: 1.5,
      timelineStartSeconds: 1.5,
      timelineWindowSeconds: 0.15,
      trigger: '约 1.5 秒后爆炸',
      effect: '对范围内目标造成爆炸伤害；距离、护甲和遮挡会改变实际伤害。',
      color: '#f09b77'
    },
    {
      id: 'fire',
      short: '火',
      icon: '▰',
      name: '燃烧瓶 / 燃烧弹',
      className: 'weapon_molotov / weapon_incgrenade',
      perPlayer: 1,
      teamMax: 5,
      duration: 'T 7.0 秒 · CT 5.5 秒',
      durationSeconds: { T: 7, CT: 5.5 },
      trigger: '接触地面后点燃',
      effect: '在落点附近铺开火焰并持续造成伤害；烟雾可以熄灭火焰，火焰会受地面与碰撞影响。',
      color: '#ff9a62'
    },
    {
      id: 'decoy',
      short: '诱',
      icon: '◌',
      name: '诱饵弹',
      className: 'weapon_decoy',
      perPlayer: 1,
      teamMax: 5,
      duration: '约 15 秒声音周期',
      durationSeconds: 15,
      trigger: '落地后开始播放',
      effect: '模拟当前持有武器的枪声并制造误导；它不产生烟、火或闪光效果。',
      color: '#b39be8'
    }
  ],
  maps: [
    {
      id: 'dust2',
      name: '沙2',
      english: 'Dust II',
      overview: 'de_dust2_v2',
      image: './maps/de_dust2.png',
      overviewFile: 'de_dust2.txt',
      overviewSource: 'https://github.com/SteamTracking/GameTracking-CS2/blob/master/game/csgo/pak01_dir/resource/overviews/de_dust2.txt',
      imageSource: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_dust2_radar_psd.png',
      note: 'A 长、B 洞与中路是最适合先建立投掷库的三条主线。',
      calibration: { posX: -2476, posY: 3239, scale: 4.4, rotate: 1 },
      spawns: { CT: { x: 62, y: 21 }, T: { x: 39, y: 91 } },
      bombs: { A: { x: 80, y: 16 }, B: { x: 21, y: 12 } },
      effects: [
        { id: 'd2-mid-smoke', utility: 'smoke', label: '中路 / XBOX 烟', x: 48, y: 42, r: 7 },
        { id: 'd2-a-smoke', utility: 'smoke', label: 'A 区烟雾', x: 78, y: 21, r: 8 },
        { id: 'd2-a-fire', utility: 'fire', label: 'A 区火焰', x: 77, y: 25, rx: 8, ry: 5 },
        { id: 'd2-mid-flash', utility: 'flash', label: '中路闪光', x: 48, y: 35, r: 16, angle: 180 },
        { id: 'd2-mid-he', utility: 'he', label: '中路 HE', x: 47, y: 42, r: 9 },
        { id: 'd2-b-decoy', utility: 'decoy', label: 'B 洞诱饵', x: 24, y: 23, r: 7 }
      ],
      lineups: [
        {
          id: 'dust2-xbox-lower',
          utility: 'smoke',
          side: 'T',
          name: 'XBOX 烟 · 下洞',
          from: { label: '下洞', x: 35, y: 43 },
          target: { label: 'XBOX', x: 49, y: 42 },
          technique: '站定 + 左键',
          movement: '站定',
          airTime: '1.7 秒',
          steps: [
            '从下洞进入中路前，在墙体参照点旁站定。',
            '按固定瞄点微调准星，使用普通左键投掷，不加入跳投。',
            '确认烟云停在 XBOX 附近，再让队友接中路或过点。'
          ],
          result: '封住中路箱体附近的视线，方便 T 方争夺中路。',
          source: 'https://csnades.gg/dust2/smokes/xbox-from-lower-tunnels',
          updated: '2024-01-18',
          media: { poster: 'https://assets.csnades.gg/nades/dust2-smoke-epau9Q3Dll/thumbnail.webp', video: 'https://assets.csnades.gg/nades/dust2-smoke-epau9Q3Dll/hq.mp4' }
        },
        {
          id: 'dust2-a-cross-long',
          utility: 'smoke',
          side: 'T',
          name: 'A Cross 烟 · 长门',
          from: { label: '长门', x: 69, y: 52 },
          target: { label: 'A Cross', x: 78, y: 26 },
          technique: '跑动 + 跳投',
          movement: '跑动',
          airTime: '4.8 秒',
          steps: [
            '从长门外进入固定站位，先让身体贴住参照墙线。',
            '对准 A 区上方固定参照点，按 W 后紧接空格并立即左键释放。',
            '烟落地后再跟进过马路；不要在烟还未成形时提前露身位。'
          ],
          result: '封锁 A Cross 交叉火力，配合长管或短道进攻。',
          source: 'https://csnades.gg/dust2/smokes/a-cross-from-long-doors-b',
          updated: '2024-05-28',
          media: { poster: 'https://assets.csnades.gg/nades/dust2-smoke-N6LQBzQWM5/thumbnail.webp', video: 'https://assets.csnades.gg/nades/dust2-smoke-N6LQBzQWM5/hq.mp4' }
        }
      ]
    },
    {
      id: 'mirage',
      name: '米拉吉',
      english: 'Mirage',
      overview: 'de_mirage',
      image: './maps/de_mirage.png',
      overviewFile: 'de_mirage.txt',
      overviewSource: 'https://github.com/SteamTracking/GameTracking-CS2/blob/master/game/csgo/pak01_dir/resource/overviews/de_mirage.txt',
      imageSource: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_mirage_radar_psd.png',
      note: '中路窗、A Jungle 与 Stairs 是最常用的基础进攻烟。',
      calibration: { posX: -3230, posY: 1713, scale: 5.0, rotate: 0 },
      spawns: { CT: { x: 28, y: 70 }, T: { x: 87, y: 36 } },
      bombs: { A: { x: 54, y: 76 }, B: { x: 23, y: 28 } },
      effects: [
        { id: 'mirage-window-smoke', utility: 'smoke', label: '中路窗烟', x: 36, y: 34, r: 7 },
        { id: 'mirage-jungle-smoke', utility: 'smoke', label: 'Jungle 烟', x: 48, y: 66, r: 7 },
        { id: 'mirage-a-fire', utility: 'fire', label: 'A 默认火', x: 55, y: 75, rx: 8, ry: 5 },
        { id: 'mirage-mid-flash', utility: 'flash', label: '中路闪光', x: 44, y: 46, r: 15, angle: 90 },
        { id: 'mirage-mid-he', utility: 'he', label: '中路 HE', x: 39, y: 43, r: 9 },
        { id: 'mirage-b-decoy', utility: 'decoy', label: 'B 区诱饵', x: 25, y: 27, r: 7 }
      ],
      lineups: [
        {
          id: 'mirage-window-tspawn',
          utility: 'smoke',
          side: 'T',
          name: '中路窗烟 · T Spawn',
          from: { label: 'T Spawn', x: 87, y: 36 },
          target: { label: 'Window', x: 36, y: 34 },
          technique: '跑动 + 跳投',
          movement: '跑动',
          airTime: '7.2 秒',
          steps: [
            '在 T Spawn 找到与当前出生位相匹配的站位；不同出生位要先选对应参照。',
            '准星对准屋檐固定点，按 W + 空格后立即释放手雷。',
            '投出后跟随中路队友；这是精确跳投，先在练习房重复确认。'
          ],
          result: '封住中路 Window，降低 CT 从窗位观察中路的能力。',
          source: 'https://csnades.gg/mirage/smokes/window-from-t-spawn-c',
          updated: '2025-11-05',
          media: { poster: 'https://assets.csnades.gg/nades/mirage-smoke-VrvjVQyEOz/thumbnail.webp', video: 'https://assets.csnades.gg/nades/mirage-smoke-VrvjVQyEOz/hq.mp4' }
        },
        {
          id: 'mirage-jungle-a-ramp',
          utility: 'smoke',
          side: 'T',
          name: 'Jungle 烟 · A Ramp',
          from: { label: 'A Ramp', x: 67, y: 61 },
          target: { label: 'Jungle', x: 48, y: 66 },
          technique: '站定 + 跳投',
          movement: '站定',
          airTime: '8.1 秒',
          steps: [
            '在 A Ramp 固定站位，身体贴住参照边缘并保持站定。',
            '将准星放到上方固定参照点，使用跳投完成释放。',
            '进点时让烟先成形；Jungle 烟通常要和 Stairs / Ticket Booth 的烟配合。'
          ],
          result: '切断 Jungle 对 A 区的主要视线，减少进点时的交叉枪线。',
          source: 'https://csnades.gg/mirage/smokes/jungle-from-a-ramp',
          updated: '2024-01-20',
          media: { poster: 'https://assets.csnades.gg/nades/mirage-smoke-IDOx7cwRPw/thumbnail.webp', video: 'https://assets.csnades.gg/nades/mirage-smoke-IDOx7cwRPw/hq.mp4' }
        },
        {
          id: 'mirage-stairs-tspawn',
          utility: 'smoke',
          side: 'T',
          name: 'Stairs 烟 · T Spawn',
          from: { label: 'T Spawn', x: 87, y: 36 },
          target: { label: 'Stairs', x: 52, y: 72 },
          technique: '站定 + 跳投',
          movement: '站定',
          airTime: '9.4 秒',
          steps: [
            '从 T Spawn 走到固定站位，先确认不是 Window 烟的出生位变体。',
            '对准屋檐或高点参照，站定后用跳投释放。',
            '进 A 时观察烟云是否完整覆盖 Stairs，再决定从 Ramp 或 Palace 补枪。'
          ],
          result: '遮住 Stairs 方向的 CT 枪线，常与 Jungle 烟组成基础 A 烟雾。',
          source: 'https://csnades.gg/mirage/smokes/stairs-from-t-spawn',
          updated: '2025-05-01',
          media: { poster: 'https://assets.csnades.gg/nades/mirage-smoke-HM7RUQkS6z/thumbnail.webp', video: 'https://assets.csnades.gg/nades/mirage-smoke-HM7RUQkS6z/hq.mp4' }
        }
      ]
    },
    {
      id: 'inferno',
      name: '小镇',
      english: 'Inferno',
      overview: 'de_inferno',
      image: './maps/de_inferno.png',
      overviewFile: 'de_inferno.txt',
      overviewSource: 'https://github.com/SteamTracking/GameTracking-CS2/blob/master/game/csgo/pak01_dir/resource/overviews/de_inferno.txt',
      imageSource: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_inferno_radar_psd.png',
      note: '香蕉道的 Coffins / CT 与 B 入口烟，是小镇最值得先练的基础组合。',
      calibration: { posX: -2087, posY: 3870, scale: 4.9, rotate: 0 },
      spawns: { CT: { x: 90, y: 35 }, T: { x: 10, y: 67 } },
      bombs: { A: { x: 81, y: 69 }, B: { x: 49, y: 22 } },
      effects: [
        { id: 'inferno-coffins-smoke', utility: 'smoke', label: 'Coffins 烟', x: 56, y: 21, r: 7 },
        { id: 'inferno-ct-smoke', utility: 'smoke', label: 'CT 烟', x: 72, y: 35, r: 7 },
        { id: 'inferno-b-fire', utility: 'fire', label: 'B 点火焰', x: 52, y: 25, rx: 8, ry: 5 },
        { id: 'inferno-banana-flash', utility: 'flash', label: '香蕉闪光', x: 47, y: 39, r: 15, angle: 20 },
        { id: 'inferno-banana-he', utility: 'he', label: '香蕉 HE', x: 41, y: 42, r: 9 },
        { id: 'inferno-ct-decoy', utility: 'decoy', label: 'CT 诱饵', x: 88, y: 35, r: 7 }
      ],
      lineups: [
        {
          id: 'inferno-coffins-halfwall',
          utility: 'smoke',
          side: 'T',
          name: 'Coffins 烟 · Half-Wall',
          from: { label: 'Half-Wall', x: 21, y: 43 },
          target: { label: 'Coffins', x: 56, y: 21 },
          technique: '站定 + 跳投',
          movement: '站定',
          airTime: '6.5 秒',
          steps: [
            '在香蕉道 Half-Wall 找到墙边固定站位，保持身体不移动。',
            '用墙体和屋檐的交点作瞄点，跳起并立即左键释放。',
            '等烟落到 Coffins 后再进入 B；过早冲出会把自己交给 CT / Coffins 枪线。'
          ],
          result: '封住 Coffins 方向，保护 B 点下包和后续守包位置。',
          source: 'https://csnades.gg/inferno/smokes/coffins-from-half-wall-a',
          updated: '2024-04-10',
          media: { poster: 'https://assets.csnades.gg/nades/inferno-smoke-Fomlq5TPso/thumbnail.webp', video: 'https://assets.csnades.gg/nades/inferno-smoke-Fomlq5TPso/hq.mp4' }
        },
        {
          id: 'inferno-ct-tspawn',
          utility: 'smoke',
          side: 'T',
          name: 'CT 烟 · T Spawn',
          from: { label: 'T Spawn', x: 10, y: 67 },
          target: { label: 'CT', x: 73, y: 35 },
          technique: '走动 + 跳投',
          movement: '走动',
          airTime: '6.9 秒',
          steps: [
            '从 T Spawn 走到固定参照位，保持走动节奏，不要突然加速。',
            '对准高处固定点，按跳投节奏释放；手法是跳投而非普通左键。',
            '烟落地后再由队友补 Coffins 或 New Box，避免只封一侧就强行进点。'
          ],
          result: '切断 CT 方向回防和长枪线，配合 Coffins 烟完成 B 进攻。',
          source: 'https://csnades.gg/inferno/smokes/ct-from-t-spawn',
          updated: '2024-01-20',
          media: { poster: 'https://assets.csnades.gg/nades/inferno-smoke-xWSXzEwtxB/thumbnail.webp', video: 'https://assets.csnades.gg/nades/inferno-smoke-xWSXzEwtxB/hq.mp4' }
        },
        {
          id: 'inferno-b-entrance-ct',
          utility: 'smoke',
          side: 'CT',
          name: 'B Entrance 烟 · CT',
          from: { label: 'CT', x: 88, y: 35 },
          target: { label: 'B Entrance', x: 58, y: 29 },
          technique: '左键',
          movement: '站定',
          airTime: '4.1 秒',
          steps: [
            '在 CT 侧找到固定站位，先确认没有队友正在穿越 B 入口。',
            '对准门框 / 屋檐参照点，站定后使用普通左键投掷。',
            '烟成形后配合队友退到 Coffins、First Orange 或 New Box 组织防守。'
          ],
          result: '拖慢 B 入口推进，给 CT 回防或等待队友支援争取时间。',
          source: 'https://csnades.gg/inferno/smokes/b-entrance-from-ct',
          updated: '2024-06-29',
          media: { poster: 'https://assets.csnades.gg/nades/inferno-smoke-xW7r3rJT5R/thumbnail.webp', video: 'https://assets.csnades.gg/nades/inferno-smoke-xW7r3rJT5R/hq.mp4' }
        }
      ]
    }
  ]
};
