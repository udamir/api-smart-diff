/**
 * Synthetic `.proto` corpus of the ProtoApi performance tests (F10 … F13, PROTOAPI_DESIGN §9.1) and of the benchmark
 * type `grpc` (§9.5, `bench/fixtures/grpc.js` in the main worktree carries the same generator in JavaScript): the
 * generator of the research proof of concept (`docs/research/grpc/poc/bench/bench.ts`: 170 / 1,700 / 10,200 messages,
 * about 140 KB / 1.4 MB / 8.6 MB) with comments, options, scalars, references, maps, enums and services, plus field
 * rules that the keyword rows and the Q4 transforms read (`buf.validate`, `google.api.field_behavior`, bounds), and a
 * set of mutated messages whose edits run the Q4 / Q5 transforms: a retyped bounded field (numeric spelling, S4), a
 * bound turned exclusive (bound pair, S3), a validation rule and a field behaviour changed (lifted keywords, A7 /
 * PD-19), a comment annotation narrowed, a field and an enum value added, a field deprecated.
 */

const SCALARS = ["int32", "int64", "uint32", "string", "bool", "double", "bytes", "sint64", "fixed32"]

export interface ProtoCorpusOptions {
  // message indexes whose declarations are edited (the after side of a pair)
  mutate?: ReadonlySet<number>
  // services: one service per 50 messages, 10 rpcs each (default), or `methods` rpcs spread over `services` services
  services?: { services: number; methods: number }
}

/** The `.proto` text of `messages` messages in package `pkg`. */
export const protoCorpus = (messages: number, pkg: string, options: ProtoCorpusOptions = {}): string => {
  const mutate = options.mutate ?? new Set<number>()
  const out: string[] = [
    `syntax = "proto3";\n\npackage ${pkg};\n\nimport "google/protobuf/timestamp.proto";\nimport "google/api/field_behavior.proto";\nimport "buf/validate/validate.proto";\n`,
  ]
  for (let m = 0; m < messages; m++) {
    const x = mutate.has(m)
    if (m % 5 === 0) {
      // the enum of a group of five messages gains a value when one of them is mutated
      const group = [0, 1, 2, 3, 4].some((i) => mutate.has(m + i))
      out.push(
        `// Status of entity ${m}.\nenum Status${m} {\n  STATUS${m}_UNSPECIFIED = 0;\n  // Active.\n  STATUS${m}_ACTIVE = 1;\n  STATUS${m}_DELETED = 2 [deprecated = true];\n${group ? `  STATUS${m}_ARCHIVED = 3;\n` : ""}}\n`,
      )
    }
    out.push(
      `// Entity number ${m}.\n// @Example {"id": ${m}}\nmessage Entity${m} {\n  reserved 100, 101 to 110;\n  reserved "old_field";\n`,
    )
    for (let f = 0; f < 12; f++) {
      const n = f + 1
      const scalar = SCALARS[(m + f) % SCALARS.length]
      switch (f % 6) {
        case 0:
          out.push(
            f === 0
              ? // a bounded integer: retyped (S4) and its lower bound made exclusive (S3) in a mutated message
                `  // Identifier ${f}.\n  ${x ? "int64" : "int32"} field_${f} = ${n} [(buf.validate.field).${x ? "int64" : "int32"} = { ${x ? "gt" : "gte"}: 0, lte: 1000000 }];\n`
              : `  // Required. Identifier ${f}.\n  ${scalar} field_${f} = ${n};\n`,
          )
          break
        case 1:
          out.push(
            f === 1
              ? // a validated string with a field behaviour (lifted keywords, A7 / PD-19)
                `  // Optional label.\n  // @MaxLength ${x ? 32 : 64}\n  optional string label_${f} = ${n} [json_name = "lbl${f}", (buf.validate.field).string.min_len = ${x ? 2 : 1}, (google.api.field_behavior) = ${x ? "REQUIRED" : "OPTIONAL"}];\n`
              : `  // Optional label.\n  // @MaxLength 64\n  optional string label_${f} = ${n} [json_name = "lbl${f}"];\n`,
          )
          break
        case 2:
          out.push(`  repeated ${scalar} list_${f} = ${n}; // trailing\n`)
          break
        case 3:
          out.push(`  map<string, ${scalar}> attrs_${f} = ${n};\n`)
          break
        case 4:
          out.push(
            `  ${m > 0 ? `Entity${m - 1}` : "google.protobuf.Timestamp"} ref_${f} = ${n} [deprecated = ${f === 10 || (x && f === 4)}];\n`,
          )
          break
        case 5:
          out.push(`  Status${m - (m % 5)} status_${f} = ${n};\n`)
          break
      }
    }
    out.push(
      `  oneof kind {\n    string kind_a = 50;\n    int64 kind_b = 51;\n  }\n${x ? "  string added = 60;\n" : ""}  message Nested { bool flag = 1; }\n}\n`,
    )
    if (!options.services && m % 50 === 49) {
      out.push(`// Service for entities ${m - 49}..${m}.\nservice EntityService${m} {\n`)
      for (let r = 0; r < 10; r++) {
        out.push(
          `  // Gets entity.\n  rpc Get${r}(Entity${m - r}) returns (${r % 2 ? "stream " : ""}Entity${m - r - 1}) { option idempotency_level = NO_SIDE_EFFECTS; }\n`,
        )
      }
      out.push(`}\n`)
    }
  }
  if (options.services) {
    const { services, methods } = options.services
    const per = Math.ceil(methods / services)
    for (let s = 0; s < services; s++) {
      out.push(`// Service ${s}.\nservice Service${s} {\n`)
      for (let r = 0; r < per && s * per + r < methods; r++) {
        const i = s * per + r
        out.push(
          `  // Method ${i}.\n  rpc Call${r}(Entity${i % messages}) returns (${r % 3 === 0 ? "stream " : ""}Entity${(i * 7 + 3) % messages});\n`,
        )
      }
      out.push(`}\n`)
    }
  }
  return out.join("")
}

/** Indexes of 1 % of `messages` messages (at least one), spread over the corpus: 7, 107, 207, … */
export const onePercent = (messages: number): Set<number> =>
  new Set(Array.from({ length: Math.max(1, Math.ceil(messages / 100)) }, (_, i) => (i * 100 + 7) % messages))
