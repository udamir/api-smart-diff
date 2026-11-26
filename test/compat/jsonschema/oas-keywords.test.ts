import { runCases } from "../../helpers/compat"
import { cases } from "./oas-keywords.cases"

runCases("jsonschema", "oas-keywords", cases, import.meta.filename)
