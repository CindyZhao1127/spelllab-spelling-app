# SpellLab 桌面版（Python）

把网页版变成一个**真正的本地桌面程序**：Python 标准库起一个只监听 `127.0.0.1` 的服务，用 **SQLite 文件**保存全部学习数据，再用 Edge / Chrome 的 `--app` 独立窗口打开界面（没有地址栏、标签栏，看起来和普通桌面软件一样）。

**零第三方依赖** —— 不需要 pip install 就能跑。界面仍是仓库根目录那份 `SpellLab.html`，网页版和桌面版共用同一份代码。

## 快速开始

要求：Python 3.9+，Windows 上装有 Edge 或 Chrome（本机已检测到 WebView2 运行时）。

```bash
cd desktop
python app.py
```

或双击 `run.bat`。启动后会弹出独立窗口，控制台显示：

```
SpellLab 桌面版  v1.0.0
地址     http://127.0.0.1:8765/
数据库   C:\...\desktop\data\spelllab.db
关闭窗口或按 Ctrl+C 结束程序
```

关闭窗口，Python 进程与服务会一起退出。端口被占用时会自动往后找一个空闲端口。

常用参数：

| 参数 | 说明 |
|---|---|
| `--port 8765` | 指定端口（默认 8765，占用则自动顺延） |
| `--db D:/mydata/spelllab.db` | 自定义数据库位置，可放网盘/U 盘 |
| `--html <路径>` | 指定 `SpellLab.html` |
| `--no-browser` | 只起服务，自己在浏览器打开上面的地址 |
| `--pywebview` | 用原生 WebView 窗口，需先 `pip install -r requirements-optional.txt` |

## 数据放在哪

默认 `desktop/data/spelllab.db`；打包成 exe 后是 **exe 同目录**的 `data/spelllab.db`（`dist/data/`），不会再落到 PyInstaller 的临时解压目录里。若程序所在目录不可写（例如装在 `C:\Program Files`），自动回退到 `%APPDATA%\SpellLab\`。这是**普通 SQLite 数据库文件**，可以直接用 DB Browser for SQLite、VS Code SQLite 插件或 `sqlite3` 命令行打开。

| 表 | 内容 |
|---|---|
| `state` | 全量状态 JSON 快照（应用读写的权威副本，只有一行） |
| `meta` | schema 版本 |
| `grades` / `books` | 年级、教材版本 |
| `packs` / `units` | 教材包、单元 |
| `questions` / `words` | 题目（含 hints、chunks JSON 文本）与单词表 |
| `vocab` / `progress` / `wrong` / `stats` | 生词本、掌握度、错题、学习统计 |

每次保存时，`state` 快照与所有规范表在**同一个事务**里更新，永远一致；内容没变化时只更新快照，跳过规范表重建。启用 WAL 模式，多个窗口同时读写也安全。内置课程单元直接写在 HTML 里，不属于"用户数据"，所以不在数据库中。

`data/exports/` 存放从界面「保存备份到磁盘」生成的 JSON 文件，`data/browser-profile/` 是独立窗口的浏览器配置（可删，会自动重建）。

## 从网页版迁移

1. 网页版 →「存储」→「导出全库备份」，得到 `spelllab-backup-日期.json`。
2. 任选一种：
   - 把文件放进 `desktop/data/`，改名为 `spelllab-backup.json`（或保留 `spelllab-data*.json` / `spelllab-backup*.json` 前缀），**桌面版首次启动会自动导入**；
   - 或在桌面版「存储」页点「从浏览器备份恢复」，直接选文件。

反过来，桌面版「保存备份到磁盘」导出的 JSON 也能在网页版「从 JSON 备份恢复」里打开。

## 桌面版与网页版的区别

| | 网页版（双击 HTML） | 桌面版（Python） |
|---|---|---|
| 主存储 | 浏览器 IndexedDB | **SQLite `.db` 文件** |
| 界面容器 | 浏览器标签页 | 独立应用窗口 |
| 数据可见性 | 浏览器内部，需导出 | 直接打开/复制/提交到网盘 |
| 朗读 | 浏览器语音引擎 | 窗口内置语音引擎（需系统英文语音包） |
| 音效 | Web Audio | 同上 |
| 文件自动同步 | File System Access API（Chrome/Edge） | 不需要，数据本来就在磁盘文件里 |

`SpellLab.html` 通过服务端注入的 `window.__SPELLLAB_DESKTOP__` 标记判断运行模式：有标记时走 `/api/*` 读写 SQLite，没有标记时完全沿用原来的 IndexedDB + localStorage 逻辑。**同一份 HTML，两种运行方式互不干扰。**

## 本地接口

服务只绑定 `127.0.0.1` 并校验 Host 头，不对外网开放。

| 接口 | 作用 |
|---|---|
| `GET /` | 带桌面标记的 `SpellLab.html` |
| `GET /api/ping` | 版本与数据库路径 |
| `GET /api/load` | 读取全量状态 |
| `POST /api/save` | 事务写入状态 |
| `GET /api/info` | 文件大小、各表行数、最近保存时间 |
| `POST /api/export` | 把备份 JSON 写到 `data/exports/` |
| `POST /api/import` | 导入全库备份并存库 |
| `GET /api/open-folder` | 打开数据文件夹 |
| `POST /api/reset` | 清空数据库 |

## 打包成 exe（可选）

双击 `build_exe.bat`，或手动：

```bash
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --onefile --windowed --name SpellLab --add-data "../SpellLab.html;." app.py
```

产物在 `dist/SpellLab.exe`。`data/` 目录不需要打包，首次运行会在 **exe 同目录**自动创建并保存 `spelllab.db`；升级 exe 时只要保留这个 `data/` 目录，学习记录就不会丢。

## 运行测试

```bash
cd desktop
python -m unittest discover -s tests -v
```

## 常见问题

- **窗口没弹出来**：确认装了 Edge 或 Chrome；或用 `--no-browser` 自己打开控制台显示的地址。
- **朗读没声音**：系统需要装英文语音包（Windows：设置 → 时间和语言 → 语音 → 添加语音）。其余功能不受影响。
- **想换台电脑用**：复制 `data/spelllab.db`（连同 `-wal` / `-shm` 若程序正在运行则先退出）到新机器的 `data/` 即可；更稳妥的做法是导出全库备份 JSON 再导入。
- **杀毒/防火墙提示**：服务只监听本机回环地址，不联网；若被拦截，允许 `python.exe` 的本地连接即可。
- **想用原生 WebView 窗口**：`pip install -r requirements-optional.txt` 后加 `--pywebview`。Windows 需要 WebView2 Runtime（Win10/11 一般已自带）。
- **双击 `.bat` 报 `=python`、`'--upgrade' 不是内部或外部命令`、乱码中文或 `'oconfirm' 不是内部或外部命令`**：这是旧版批处理文件用了「UTF-8 中文 + `chcp 65001` + LF 换行」，cmd.exe 切换控制台代码页后会按字节重新读取文件，把命令行截断、拼接、串位造成的解析错乱。`=python` 并不是项目里缺失的文件，不需要创建它。仓库里的 `run.bat` / `build_exe.bat` 已改成**纯 ASCII 提示 + CRLF 换行 + 不切换代码页 + 不用 `^` 续行**，重新取这两个文件即可。手头只有旧副本时，绕开批处理直接用虚拟环境：
  ```bat
  cd /d C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app\desktop
  ..\.venv\Scripts\python.exe app.py
  ..\.venv\Scripts\python.exe -m pip install pyinstaller
  ..\.venv\Scripts\python.exe -m PyInstaller --noconfirm --onefile --windowed --name SpellLab --add-data "..\SpellLab.html;." app.py
  ```
- **报错里出现 `C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\python.exe`**：那是 Visual Studio 自带的 Python 3.9（本机 `py -3` 也指向它），不是本项目解释器，不要用它建虚拟环境或打包。项目统一用 `.venv\Scripts\python.exe`（Python 3.13.14）。换机器重建时在项目根目录执行 `"C:\Users\zhaoj\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m venv .venv`，或装一个 Python 3.13 后用 `python -m venv .venv`；注意参数是 `-m venv`，不要写成 `=python`。
