# SMSY-Gen02 本地复刻

[samsy.ninja](https://samsy.ninja) 的完整本地复刻——一个多人在线 3D 赛博朋克作品集。访客以 VRM 虚拟形象在 3D 城市中漫游，浏览作者的项目作品。

## 快速启动

```bash
cd /Users/zhangshuai/Desktop/hi
python3 server.py
```

打开浏览器访问 **http://localhost:3001**

首次加载需要 10–30 秒（3D 模型、纹理、音频等约 40 MB 资源）。页面会自动跳转到 `?forceWebGL=true&cdn=false`，所有资源从本地加载。

## 技术栈

| 层 | 技术 | 作用 |
|----|------|------|
| 3D 引擎 | Three.js r182dev | WebGPU 优先，WebGL2 兜底 |
| 框架 | Vue 3 + Vuex | 2D HUD 界面与状态管理 |
| 动画 | GSAP | 补间动画、相机过渡、UI 出入场 |
| 多人联机 | PartyKit (WebSocket) | 实时同步玩家位置与动作 |
| 虚拟形象 | Three-VRM | VRM 模型加载、SpringBone 物理 |
| 模型压缩 | Draco | GLB 模型压缩，Web Worker 解码 |
| 文字渲染 | BMFont | 3D 空间内的位图文字 |
| 构建 | Vite | 打包、code-splitting、`import.meta.url` |

## 实现原理

### 启动流程

启动是一条严格的异步串行链，任何一环失败都会卡死页面：

```
new Zf0()
  ├─ Iv.preload()        预加载动画精灵图，显示 "LOADING..."
  ├─ Di.preload()        3D 世界预加载（6 块并行）
  │    ├─ P1.init()          渲染器初始化 (15%)
  │    ├─ jr.preload()       音频加载 (20%)
  │    ├─ Q0.preload()       角色控制器 (20%)
  │    ├─ On.preload()       UI 交互系统 (20%)
  │    ├─ root.preload()     3D 场景 (15%)
  │    └─ i1.preload()       纹理 (10%)
  ├─ Di.start()          场景状态切换 VOID → IDLE
  ├─ Di.play()           启动渲染循环
  └─ createVue()         挂载 Vue UI（最后一步）
```

关键设计：**3D 场景先渲染，Vue UI 最后挂载**。看到 3D 画面时 DOM 里几乎没有 Vue 节点。

### 渲染器：WebGPU 优先，WebGL2 兜底

```js
class Bi0 extends Wt0 {
  constructor(e = {}) {
    let t;
    if (e.forceWebGL) {
      t = $E;                    // WebGL2 backend
    } else {
      t = Pi0;                   // WebGPU backend
      e.getFallback = () => {    // WebGPU 不可用时自动降级
        return new $E(e);
      };
    }
    super(new t(e), e);
  }
}
```

默认尝试 WebGPU（更快的 compute shader、原生 instancing）。失败时通过 `getFallback` 自动切到 WebGL2。URL 参数 `forceWebGL=true` 可强制 WebGL。

### 3D 场景：状态机驱动

5 种状态控制相机视角和可见内容：

| 状态 | 说明 |
|------|------|
| `VOID` | 初始虚空，只有视频墙播放 loading.mp4 |
| `IDLE` | 城市全景，默认漫游视角 |
| `WORKS` | 视频墙轮播，滚轮切换 27 个项目作品 |
| `INFO` | 项目详情 |
| `ABOUT` | 关于页面 |

场景内的 3D 元素：

| 元素 | 类 | 说明 |
|------|-----|------|
| 城市 | `O40` | `cyberfix.glb` (Draco 压缩)，instanced 渲染重复构件 |
| 视频墙 | `M80` | Canvas VideoTexture，27 个项目视频轮播 + 转场着色器 |
| NPC 角色 | `n50` | VRM 模型，渲染多人联机的其他玩家 |
| 粒子轨迹 | `yw` / `Vd` | 角色移动拖尾、屏幕线条特效 |
| 反射地面 | `f20` | 实时反射 |
| 文字标牌 | `t3` | BMFont 3D 文字（项目标题/信息） |

### 相机与移动：自定义胶囊体控制器

不使用 Three.js 的 `OrbitControls`，而是自定义角色控制器 `p40`：

- 胶囊体碰撞检测（capsule vs 场景几何体）
- 球坐标相机旋转（`rotateLeft` / `rotateUp`）
- 鼠标拖拽旋转视角 + WASD 移动
- 移动速度触发粒子拖尾效果（`actualVelocity`）

### 多人联机：PartyKit WebSocket

```js
class m40 {
  constructor(room = "portfolio-world") {
    this.host = "https://tongue-require.samsy.partykit.dev/";
    this.socket = new ReconnectingWebSocket(...);  // 自动重连
  }

  connect() {
    // 连接后发送 join 消息（含位置/动画/朝向/颜色）
    this.socket.addEventListener("message", e => {
      this.handleMessage(JSON.parse(e.data));  // 接收其他玩家位置
    });
  }

  update(dt) {
    this.updateAvatarInterpolations(dt);  // 线性插值平滑其他玩家位置
  }
}
```

所有玩家进入同一个 room (`portfolio-world`)。每帧广播自己的位置/动画/朝向，收到其他玩家数据后用 lerp 插值平滑动画，避免网络抖动。其他玩家用 VRM 模型渲染，支持 SpringBone 物理摆动。

### 视频墙：双缓冲着色器转场

作品集的核心展示区——27 个项目视频在一个 3D 屏幕上轮播：

```js
class M80 {
  transitionToProject(direction) {
    // 滚轮触发转场：
    // - 双缓冲：currentProject + nextProject
    // - 着色器混合 transition(0→1) 做淡入淡出
    // - 预加载相邻视频避免卡顿
  }
}
```

不是简单切换，而是双缓冲 + 自定义着色器混合（TSL 控制混合度、噪声、边缘）。视频按需加载，预加载相邻视频。

### 着色器：TSL (Three Shading Language)

项目大量使用 Three.js 新一代着色器语言 TSL（非传统 GLSL）：

```js
// 对话框背景的顶点着色器示例
material.vertexNode = Fn(() => {
  const pos = positionAttribute;
  const transformed = shader(pos, time, ...);
  return modelViewMatrix.mul(transformed);
})();
```

`Fn()` 定义可复用着色器函数，`fragmentNode` / `vertexNode` 替代传统 ShaderMaterial。后处理用 UnrealBloom（辉光）+ 自定义 PostProcessing 链。

### 资源加载策略

```js
class F60 {  // 资源管理器
  loadVRM(url)      // VRM 模型（带 SpringBone 优化）
  loadKit(url)      // GLB 场景（Draco 解压）
  loadTexture(url)  // 纹理
  loadJson(url)     // JSON 配置
  // 所有方法都有缓存 (this.loaded)，避免重复加载
}
```

- **Draco 压缩**：`cyberfix.glb` 用 Draco 压缩，`baker.worker` Web Worker 解码
- **BMFont**：4 种字体，JSON 描述字符位置 + PNG 纹理图集
- **CDN 分流**：桌面版从 `smsygen02.b-cdn.net` 加载视频/音频（本地复刻时关闭）

## 资源路径解析规则

该项目用 Vite 打包，有两种路径解析方式。理解这点是本地复刻的关键。

**1. `fetch()` / `Three.js FileLoader` — 相对于页面 URL**

ES module 中的 `fetch()` 解析相对路径时，基准是文档根 URL，不是 JS 文件位置：

| JS 中的路径 | 实际请求地址 |
|-------------|-------------|
| `"./bmfont/aeonikbold.json"` | `/bmfont/aeonikbold.json` |
| `"./models/cyberfix.glb"` | `/models/cyberfix.glb` |
| `"./videos/loading.mp4"` | `/videos/loading.mp4` |

**2. `new URL(..., import.meta.url)` — 相对于 JS 文件位置**

主 JS 位于 `assets/js/main-ITpbzWAg.js`，所以 `../` 退一级：

| JS 中的路径 | 实际请求地址 |
|-------------|-------------|
| `"../baker.worker-5z1EDtsg.js"` | `/assets/baker.worker-5z1EDtsg.js` |
| `"../../front/triangle.svg"` | `/front/triangle.svg` |

## 本地复刻修复记录

复刻过程中遇到的 8 个关键问题及修复方式：

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | `baker.worker-5z1EDtsg.js` 缺失，预加载链中断 | 下载到 `assets/` |
| 2 | 资源路径解析错误，大量 404 | 所有资源同步到根级目录 |
| 3 | `forceWebGL` 参数无效，WebGPU 初始化失败 | 修补 JS：`forceWebGL:!!(h_\|\|T4&&Y0\|\|Ki.forceWebGL)` |
| 4 | 缺少 COOP/COEP 头，SharedArrayBuffer 不可用 | `server.py` 添加跨域隔离头 |
| 5 | 视频 CDN 403 | index.html 注入 `?cdn=false` + JS 修补 `HH=!1` |
| 6 | 音频 CDN 403 | JS 修补 `IT&&(s=s.replace(...))` + `es0=!1` |
| 7 | 教程重定向循环 | localStorage 预置 `TUTORIAL=true` |
| 8 | WebGPU 初始化失败 | HTML 自动添加 `?forceWebGL=true` |

## 项目结构

```text
├── index.html              入口页面（跳过教程 + 参数注入）
├── server.py               Python HTTP 服务器（含 COOP/COEP 头）
├── server.js               Node.js HTTP 服务器（备选）
│
├── assets/                 Vite 构建输出
│   ├── js/main-ITpbzWAg.js     主 JS bundle (3.9MB)
│   ├── js/editor-CeC_GOHp.js   编辑器 chunk
│   ├── js/gb-tv6B1fGx.js       GameBoy 阅读器 chunk
│   ├── baker.worker-5z1EDtsg.js  动画烘焙 Worker
│   ├── js/lib/                 Draco 解码器
│   └── css/main-rb3R8F1q.css   样式
│
├── models/                 3D GLB 模型 (cyberfix.glb)
├── textures/               纹理图片
├── sound/                  音效 MP3 (10 个)
├── vrm/                    VRM 虚拟形象 (owo3.vrm, owo7.vrm)
├── videos/                 项目视频 MP4 (27 个 + loading.mp4)
├── bmfont/                 BMFont 字体数据 (JSON + PNG)
├── interaction/            UI 交互数据 (JSON + 精灵图)
├── lib/                    Draco 解码器 (根级副本)
├── front/                  SVG 图标
└── preloader/              预加载动画精灵图
```

## 调试

| 参数 | 作用 |
|------|------|
| `?forceWebGL=true` | 强制使用 WebGL2（跳过 WebGPU） |
| `?cdn=false` | 视频/音频从本地加载（不走 CDN） |
| `?debug=true` | 开启 Three.js shader 错误检查 |
| `?editor=true` | 加载场景编辑器 |
| `?fps=60` | 限制帧率 |

首次进入时 Chrome 要求用户手势才能启动音频，点击页面即可激活。

## 引用来源

- 原始站点：https://samsy.ninja
- 作者：SMSY (samsyyyy)
- 所有资源版权归原作者所有，仅供学习研究使用
