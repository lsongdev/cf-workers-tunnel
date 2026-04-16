# AGENT INSTRUCTIONS: hostc CLI 子项目

本说明专为 `apps/cli` Node.js CLI 工具设计，聚焦开发、构建、入口和约定。

## 目录结构

- `src/index.ts`：CLI 主入口，输出 "hostc"。
- `tsconfig.json`：TypeScript 类型检查配置。
- `tsup.config.ts`：CLI 打包配置，用于产出可单包发布的 `dist/`。
- `package.json`：定义 bin 入口、构建命令等。

## 开发与构建

1. 构建 CLI：
   ```sh
   pnpm build
   ```
2. 调试 CLI：
   ```sh
   node dist/index.js 3000
   ```
3. 如需联调本地或 staging Worker，可通过环境变量覆盖服务端地址：
   ```sh
   HOSTC_SERVER_URL=http://127.0.0.1:8787 node dist/index.js 3000
   ```

## 约定与建议

- 所有 CLI 逻辑建议集中在 `src/` 下，主入口为 `src/index.ts`。
- 发布/分发时以 `dist/index.js` 作为 bin 入口，CLI 通过 `tsup` 打包，发布包不依赖单独发布 `@hostc/tunnel-protocol`。
- CLI 的主调用形式是 `hostc <port>`，默认暴露同一端口上的 HTTP 请求与 WebSocket upgrade。
- `HOSTC_SERVER_URL` 仅用于开发、联调或 staging 覆盖 Hostc 服务端地址，不作为公开主参数。
- CLI 当前流程为：先调用 Workers API 创建 tunnel，随后在内存里持有 session token，定时 refresh，并在 WebSocket 异常断开后自动刷新 connect url 再重连。
- CLI 当前不暴露自定义 subdomain 参数，公网 subdomain 由 Workers 侧随机分配。
- 如需扩展命令行参数，建议继续沿用 commander。

---
如需全局约定，见项目根目录 AGENTS.md。