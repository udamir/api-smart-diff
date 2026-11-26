import { runCases } from "../../helpers/compat"
import { cases } from "./combinators.cases"

runCases("jsonschema", "combinators", cases, import.meta.filename)
