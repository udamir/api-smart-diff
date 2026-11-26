import { runCases } from "../../helpers/compat"
import { cases } from "./json-schema-diff.cases"

// every case sets its own area (an existing JSON Schema area); "combinators" is only the fallback
runCases("jsonschema", "combinators", cases, import.meta.filename)
