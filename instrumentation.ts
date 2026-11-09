export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) return;

  const [{ registerOTel }, { detourSampler }] = await Promise.all([
    import("@vercel/otel"),
    import("./lib/telemetry.ts"),
  ]);
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "detour",
    // Framework request spans can contain invitation URLs. Export only our safe operation spans.
    traceSampler: detourSampler,
    instrumentations: [],
  });
}
