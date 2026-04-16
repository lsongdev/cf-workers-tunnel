import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs"],
	platform: "node",
	target: "node18",
	outDir: "dist",
	bundle: true,
	clean: true,
	splitting: false,
	external: ["chalk", "commander", "ws"],
});