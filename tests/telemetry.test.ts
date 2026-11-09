import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { detourSampler, traceOperation } from "../lib/telemetry.ts";

function captureSpans(t: TestContext) {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    sampler: detourSampler,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  assert.equal(trace.setGlobalTracerProvider(provider), true);
  t.after(async () => {
    trace.disable();
    await provider.shutdown();
  });
  return { exporter, provider };
}

test("operation spans preserve results, safe attributes, and completion", async (t) => {
  const { exporter, provider } = captureSpans(t);
  const result = await traceOperation("detour.network", { count: 2 }, async () => "ready");
  await provider.forceFlush();
  assert.equal(result, "ready");
  const [span] = exporter.getFinishedSpans();
  assert.equal(span.name, "detour.network");
  assert.deepEqual(span.attributes, { count: 2, "detour.operation": true });
  assert.deepEqual(span.status, { code: SpanStatusCode.OK });
  assert.equal(span.ended, true);
});

test("failed operation spans close without recording private exception text", async (t) => {
  const { exporter, provider } = captureSpans(t);
  const failure = new Error("private profile body and token");
  await assert.rejects(
    traceOperation("detour.publish", {}, async () => { throw failure; }),
    (error) => error === failure,
  );
  await provider.forceFlush();
  const [span] = exporter.getFinishedSpans();
  assert.deepEqual(span.status, { code: SpanStatusCode.ERROR });
  assert.deepEqual(span.events, []);
  assert.equal(span.ended, true);
  assert.deepEqual(span.attributes, { "detour.operation": true });
});

test("automatic request spans are dropped while explicit operations are exported", async (t) => {
  const { exporter, provider } = captureSpans(t);
  await traceOperation("detour.invitation", {}, async () => {
    const request = trace.getTracer("next").startSpan("GET /invite/private-token", {
      attributes: { "http.url": "https://detour.example/invite/private-token" },
    });
    request.recordException(new Error("private request body"));
    request.end();
  });
  await provider.forceFlush();
  assert.deepEqual(exporter.getFinishedSpans().map((span) => span.name), ["detour.invitation"]);
});
