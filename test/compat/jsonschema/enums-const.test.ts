import { runCases } from "../../helpers/compat"
import { cases } from "./enums-const.cases"

runCases("jsonschema", "enums-const", cases, import.meta.filename)
