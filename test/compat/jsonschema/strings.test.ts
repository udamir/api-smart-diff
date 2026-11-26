import { runCases } from "../../helpers/compat"
import { cases } from "./strings.cases"

runCases("jsonschema", "strings", cases, import.meta.filename)
