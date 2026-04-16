# AGENT INSTRUCTIONS: hostc CLI 子项目

本说明专为 `apps/cli` Node.js CLI 工具设计，聚焦开发、构建、入口和约定。

## 目录结构

- `src/index.ts`：CLI 主入口，输出 "hostc"。
- `tsconfig.json`：TypeScript 配置，编译到 `dist/` 目录。
- `package.json`：定义 bin 入口、构建命令等。

## 开发与构建

1. 构建 CLI：
   ```sh
   pnpm build
   ```
2. 调试 CLI：
   ```sh
   node dist/index.js http 5173
   ```

## 约定与建议

- 所有 CLI 逻辑建议集中在 `src/` 下，主入口为 `src/index.ts`。
- 发布/分发时以 `dist/index.js` 作为 bin 入口。
- CLI 当前流程为：先调用 Workers API 创建 tunnel，再建立 WebSocket tunnel 连接。
- 如需扩展命令行参数，建议继续沿用 commander。

---
如需全局约定，见项目根目录 AGENTS.md。