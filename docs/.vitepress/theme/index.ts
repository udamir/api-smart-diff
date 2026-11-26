import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"

import "./style.css"

// the demo and example components are imported by the pages that use them, so other pages do not load the engine
export default {
  extends: DefaultTheme,
} satisfies Theme
