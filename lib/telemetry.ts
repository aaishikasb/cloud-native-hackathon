import { SpanStatusCode, trace } from "@opentelemetry/api";
import { SamplingDecision, type Sampler } from "@opentelemetry/sdk-trace-base";

export const detourSampler: Sampler = {
  shouldSample(_context, _traceId, _name, _kind, attributes) {
    return {
      decision: attributes["detour.operation"] === true
        ? SamplingDecision.RECORD_AND_SAMPLED
        : SamplingDecision.NOT_RECORD,
    };
  },
  toString: () => "DetourOperationsOnly",
};

// Attributes must be operation labels and counts, never profile text or credentials.
export async function traceOperation<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  callback: () => Promise<T>,
): Promise<T> {
  return trace.getTracer("detour").startActiveSpan(name, {
    attributes: { ...attributes, "detour.operation": true },
  }, async (span) => {
    try {
      const result = await callback();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Raw exception messages can contain Elasticsearch queries and private data.
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
