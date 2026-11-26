import { runCases } from "../../helpers/compat"
import { cases } from "./drafts.cases"

runCases("jsonschema", "drafts", cases, import.meta.filename)
