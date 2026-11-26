import { runCases } from "../../helpers/compat"
import { cases } from "./annotations.cases"

runCases("jsonschema", "annotations", cases, import.meta.filename)
