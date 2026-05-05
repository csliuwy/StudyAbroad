# Doc Convention

All social and communication documents live under this folder.

## 会话总结（Cursor / 主结论）

- **一律只写在本仓库**：`StudyAbroad/doc/`（不要写到上一级目录的 `doc/`，以免与仓库根 `StudyAbroad` 混淆）。
- 命名仍用下文 **Daily Main Conclusion** 的 `YYYY-MM-DD_HHmm_…md` 规则。

## 仓库路径 vs 线上域名（避免混淆）

这三件事**互不相干**，改其一不必改其二：

| 名称 | 含义 | 改名是否影响 `http://studyabroad.martxdata.com/` |
|------|------|--------------------------------------------------|
| **本机/服务器上的克隆路径** | 例如 `~\code\StudyAbroad\`（父目录叫 `code` 或 `studyAbroad` 均可） | **否**。只是磁盘路径。 |
| **公网域名** | DNS 里的 `studyabroad.martxdata.com` → 公网 IP | **否**，与文件夹名无关。 |
| **服务器上的站点目录** | Nginx 的 `root`，当前示例为 **`/var/www/studyabroad`**（与 Git 克隆路径无关） | **否**，除非你改了 Nginx 的 `root` 或没同步 `dist` 文件。 |

**系统做法建议**：父目录用 **`code`**（或任意名）仅作「放代码的根」；仓库目录保持 **`StudyAbroad`**；线上静态文件固定用 **`/var/www/…`**（或你自定的目录），与克隆路径分离。保证域名可访问的条件仍是：**DNS A 记录正确、安全组放行 TCP 80、Nginx `server_name` 与证书（若 HTTPS）与域名一致、后端 8080 可用、`/api` 反代正常**——与 `~\code\StudyAbroad` 这种路径无关。

## Daily Main Conclusion

- Use one summary document per main conclusion.
- File name format: `YYYY-MM-DD_HHmm_short-conclusion.md`
- Example: `2026-05-03_0945_travefy-as-primary-publish-target.md`

## Suggested Subfolders

- `communications/`: curated chat/email excerpts
- `meeting-notes/`: internal and partner meeting notes
- `decisions/`: architecture and product decisions

## Notes

- Avoid Windows-illegal characters in file names: `:`, `*`, `?`, `"`, `<`, `>`, `|`.
- Keep each summary short and decision-focused.
