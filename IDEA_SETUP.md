# 在 JetBrains IDE 里开发 SpellLab

这个仓库已经配置成标准的 JetBrains **Python 项目**（`PYTHON_MODULE`），并带一个项目内虚拟环境 `.venv`。配置对 **PyCharm（Community / Pro）** 和 **装了 Python 插件的 IntelliJ IDEA** 通用。

## 已经配好的内容

| 位置 | 内容 |
|---|---|
| `.venv/` | 项目内虚拟环境，Python 3.13.14，已创建；被 `.gitignore` 忽略 |
| `.idea/misc.xml` | 项目 SDK 改为 `PythonSDK`（名称 `Python 3.13 (spelllab)`），移除原来的 JDK 17 / `out` 输出目录 |
| `.idea/spelllab-spelling-app.iml` | 模块类型改为 `PYTHON_MODULE`；`desktop/` 设为源码根、`desktop/tests/` 设为测试根；排除 `.venv/`、`desktop/data/`、`build/`、`dist/`、`out/`；测试框架设为 Unittests |
| `.idea/runConfigurations/` | 3 个开箱即用的运行配置（见下表） |
| `.gitignore` | 从「忽略整个 `.idea/`」改为「提交项目级配置、忽略个人状态」 |
| `desktop/run.bat`、`build_exe.bat` | 优先使用 `.venv` 的解释器，找不到才回退到系统 `python` |

**解释器路径**：`C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app\.venv\Scripts\python.exe`

## 先说清楚：这台机器上的 IDEA 版本

本机装的是 **IntelliJ IDEA Community Edition 2025.1.2**（build `251.26094.121`），安装目录里没有 Python 插件。Community 默认只提供 Java / Kotlin 能力，所以：

- 直接用它打开时，Python 语法高亮、补全、调试，以及下面 3 个 Python 运行配置都**不会生效**；
- IDE 可能提示「未知模块类型」或「Project SDK is not defined」。这是版本能力限制，不是项目配置错误。

任选一条路即可。

### A. 留在 IntelliJ IDEA

1. `Settings → Plugins → Marketplace` 搜索 **`Python Community Edition`**（JetBrains 官方免费插件，功能对应 PyCharm Community）。
2. 能安装就安装并重启 IDEA，然后 `File → Project Structure → SDKs` 添加 Python SDK，指向上面的 `.venv\Scripts\python.exe`；项目配置里已写好 SDK 名称 `Python 3.13 (spelllab)`，若 IDE 只是提示「选择解释器」，选这个 venv 即可。
3. 若 Marketplace 提示与当前版本不兼容（本机 build 较旧，Marketplace 上 `251.*` 的插件构建要求 `251.28774+`），把 IDEA 升级到 2025.1.3 以上再装，或者改走 B。

### B. 换 PyCharm Community（免费，最省事）

直接用 **PyCharm Community** 打开同一个目录 `C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app`。`.idea` 配置通用：首次打开按提示把解释器选为 `.venv\Scripts\python.exe`，运行配置立刻可用，支持断点调试与 unittest 测试窗口。

### C. 不装插件也能跑（当前 IDEA Community 兜底）

在 IDEA 内置终端里执行：

```bat
.\.venv\Scripts\python.exe desktop\app.py
```

或者运行 `.\desktop\run.bat`（会自动优先用 `.venv`）。

想在菜单里一键启动，可以加两个 `Settings → Tools → External Tools` 条目：

| 字段 | 启动桌面版 | 跑全部测试 |
|---|---|---|
| Name | `SpellLab 桌面版` | `SpellLab 全部测试` |
| Program | `C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app\.venv\Scripts\python.exe` | 同左 |
| Arguments | `desktop\app.py` | `-m unittest discover -s desktop/tests -v` |
| Working directory | `C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app` | 同左 |

建议勾上 `Open console for tool output`。External Tools 是 IDEA 平台自带功能，不依赖 Python 插件；缺点是只能看输出，不能断点调试。

## 运行配置（装了 Python 插件 / 用 PyCharm 后可见）

| 名称 | 作用 |
|---|---|
| `SpellLab 桌面版` | 运行 `desktop/app.py`，打开独立应用窗口（默认端口 8790） |
| `SpellLab 服务（不开窗口）` | 带 `--no-browser --port 8792`，方便在浏览器或调试器里访问 `http://127.0.0.1:8792/` |
| `SpellLab 全部测试` | 等价于 `python -m unittest discover -s desktop/tests -v` |

工作目录都设为项目根，环境变量带 `PYTHONUNBUFFERED=1`（日志实时输出）和 `SPELLLAB_DB=$PROJECT_DIR$/desktop/dist/data/spelllab.db`。后者让 IDEA 里运行源码与双击 `run.bat` / `dist/SpellLab.exe` **共用同一个 SQLite 数据库**，不会出现「换个入口打开练习就没了」；需要隔离测试数据时，把该环境变量删掉即可回到 `desktop/data/spelllab.db`。

## 换机器 / 重新 clone

`.venv/` 和 `desktop/data/` 不进 Git。新环境在项目根重建一次即可：

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m unittest discover -s desktop/tests -v
```

然后在 IDE 里把项目解释器指向新建的 `.venv\Scripts\python.exe`。提交到 Git 的项目级配置只有：

```
.idea/.gitignore  .idea/misc.xml  .idea/modules.xml  .idea/*.iml
.idea/vcs.xml  .idea/runConfigurations/
```

`workspace.xml`、`shelf/` 等个人状态仍被忽略，不会被提交。

## 验证基线

```bash
.\.venv\Scripts\python.exe -m unittest discover -s desktop/tests -v
# Ran 17 tests ... OK
```

## 批处理脚本报错排查

双击 `desktop\run.bat` / `desktop\build_exe.bat` 若出现下面这些报错：

```
python.exe: can't open file '...\desktop\=python'
'--upgrade' 不是内部或外部命令
'栨墜鍔ㄦ墊琛?pip' 不是内部或外部命令
'oconfirm' 不是内部或外部命令
```

原因是旧脚本为 **UTF-8 中文 + `chcp 65001` + LF 换行**：cmd.exe 切换代码页后按字节重读批处理文件，命令行被截断、拼接，`=python` / `--upgrade` / `oconfirm` 都是同一处错乱的碎片，并非项目里真有这些文件。现已改为**纯 ASCII 提示 + CRLF 换行 + 不切换代码页 + 单行命令**，重新取这两个 `.bat` 即可。

另外，报错中的 `C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\python.exe` 是 Visual Studio 自带的 Python 3.9（本机 `py -3` 也指向它），**不是项目解释器**。请不要用它建 venv 或打包，统一用：

```bat
C:\Users\zhaoj\IdeaProjects\spelllab-spelling-app\.venv\Scripts\python.exe
```

在 IDEA 内置终端里最稳的兜底写法（不依赖 Python 插件、也不经过批处理解析）：

```bat
.\.venv\Scripts\python.exe desktop\app.py
.\.venv\Scripts\python.exe -m unittest discover -s desktop/tests -v
```

External Tools 里务必用完整路径填 **Program**，**Arguments** 只填 `desktop\app.py`，不要把 `=python` 之类的赋值片段写进参数。

## 只想让当前 IDEA Community 安静地看代码

把 `.idea/spelllab-spelling-app.iml` 的 `type="PYTHON_MODULE"` 改回 `JAVA_MODULE`，并把 `.idea/misc.xml` 的 `project-jdk-type` / `project-jdk-name` 改回 `JavaSDK` / `ms-17` 即可。项目文件、网页版和批处理启动方式都不受影响。
