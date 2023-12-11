import type { ChangeAnnotationResolver } from "../types"

export const keyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}

export const parentKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}
