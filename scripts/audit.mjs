import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
const base = process.env.AUDIT_URL || "http://127.0.0.1:4173";
const runs = Number(process.env.AUDIT_RUNS || 3);
const reportDir = process.env.AUDIT_REPORT_DIR || "reports/lighthouse";
await mkdir(reportDir, { recursive: true });
const summary = [];
for (const page of ["inicio", "detalhe"])
  for (const profile of ["mobile", "desktop"]) {
    const results = [];
    for (let i = 1; i <= runs; i++) {
      const chrome = await launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
        logLevel: "silent",
      });
      try {
        const desktop = profile === "desktop";
        const config = {
          extends: "lighthouse:default",
          settings: {
            formFactor: profile,
            screenEmulation: {
              mobile: !desktop,
              width: desktop ? 1440 : 390,
              height: desktop ? 1000 : 844,
              deviceScaleFactor: 1,
              disabled: false,
            },
            ...(desktop
              ? {
                  throttling: {
                    rttMs: 40,
                    throughputKbps: 10240,
                    cpuSlowdownMultiplier: 1,
                    requestLatencyMs: 0,
                    downloadThroughputKbps: 0,
                    uploadThroughputKbps: 0,
                  },
                }
              : {}),
            onlyCategories: [
              "performance",
              "accessibility",
              "best-practices",
              "seo",
            ],
          },
        };
        const result = await lighthouse(
          `${base}${page === "inicio" ? "/" : "/nft/nft-1"}`,
          { port: chrome.port, output: ["html", "json"], logLevel: "error" },
          config,
        );
        if (!result || result.lhr.runtimeError)
          throw new Error(
            result?.lhr.runtimeError?.message || "Auditoria indisponível",
          );
        const prefix = `${reportDir}/${page}-${profile}-${i}`;
        await writeFile(`${prefix}.html`, result.report[0]);
        await writeFile(`${prefix}.json`, result.report[1]);
        const entry = {
          page,
          profile,
          run: i,
          scores: Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, c]) => [
              key,
              Math.round(c.score * 100),
            ]),
          ),
          lcp: result.lhr.audits["largest-contentful-paint"].numericValue,
          cls: result.lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: result.lhr.audits["total-blocking-time"].numericValue,
        };
        results.push(entry);
        console.log(JSON.stringify(entry));
      } finally {
        await chrome.kill();
      }
    }
    const median = (values) =>
      values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    summary.push({
      page,
      profile,
      runs,
      scores: Object.fromEntries(
        Object.keys(results[0].scores).map((k) => [
          k,
          median(results.map((r) => r.scores[k])),
        ]),
      ),
      lcp: median(results.map((r) => r.lcp)),
      cls: median(results.map((r) => r.cls)),
      tbt: median(results.map((r) => r.tbt)),
    });
  }
const pkg = JSON.parse(
  await readFile("node_modules/lighthouse/package.json", "utf8"),
);
await writeFile(
  `${reportDir}/summary.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: os.platform(),
        release: os.release(),
        cpu: os.cpus()[0].model,
        lighthouse: pkg.version,
        chrome: chromium.executablePath(),
        base,
        conditions:
          "Build otimizado servido pelo preview com gzip; dados padrão; navegador novo a cada medição; throttling Lighthouse mobile padrão e desktop CPU 1x/10Mbps; MSW e Socket.IO ativos.",
      },
      results: summary,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(summary, null, 2));
