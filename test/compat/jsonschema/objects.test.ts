import { runCases } from "../../helpers/compat"
import { cases } from "./objects.cases"

runCases("jsonschema", "objects", cases, import.meta.filename)
