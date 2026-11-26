import { runCases } from "../../helpers/compat"
import { cases } from "./numbers.cases"

runCases("jsonschema", "numbers", cases, import.meta.filename)
